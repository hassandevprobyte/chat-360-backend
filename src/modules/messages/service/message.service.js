'use strict';

const {
  SENDER_TYPES,
  MESSAGE_TYPES,
  CONVERSATION_STATUS,
  NOTIFICATION_TYPES,
  VISITOR_VISIBLE_MESSAGE_TYPES,
  ERROR_CODES,
  PERMISSIONS,
} = require('../../../common/constants');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../../common/errors');
const { parseCursorQuery, cursorFilter, cursorMeta } = require('../../../common/utils/pagination');
const { requireObjectId, idEquals } = require('../../../common/utils/objectId');
const { cleanText } = require('../../../common/utils/sanitize');
const messageRepository = require('../repository/message.repository');
const conversationRepository = require('../../conversations/repository/conversation.repository');
const conversationService = require('../../conversations/service/conversation.service');
const assignmentService = require('../../conversations/service/assignment.service');
const attachmentService = require('../../attachments/service/attachment.service');
const shortcutService = require('../../messageShortcuts/service/messageShortcut.service');
const authorizationService = require('../../workspaces/service/authorization.service');
const userRepository = require('../../users/repository/user.repository');
const visitorRepository = require('../../visitors/repository/visitor.repository');
const notificationService = require('../../notifications/service/notification.service');
const emitter = require('../../../realtime/emitter');
const { serializeMessage, serializeMessageForVisitor, buildPreview } = require('../serializer');
const { serializeAttachment, serializeAttachmentForVisitor } = require('../../attachments/serializer');

const isVisitorVisible = (type) => VISITOR_VISIBLE_MESSAGE_TYPES.includes(type);

/** Derives the message type when the client did not pin one. */
function resolveType(requestedType, attachments) {
  // A plain TEXT request that carries attachments is really an IMAGE/FILE
  // message; only an explicit non-default type is honoured as given.
  if (requestedType && !(requestedType === MESSAGE_TYPES.TEXT && attachments.length)) return requestedType;
  if (!attachments.length) return MESSAGE_TYPES.TEXT;
  const allImages = attachments.every((a) => String(a.mimeType).startsWith('image/'));
  return allImages ? MESSAGE_TYPES.IMAGE : MESSAGE_TYPES.FILE;
}

const toEmbeddedAttachments = (attachments) =>
  attachments.map((a) => ({
    attachment: a._id,
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
  }));

/** Single write that moves the conversation's denormalised counters forward. */
function conversationUpdateForMessage(message, { incAgentUnread = 0, incVisitorUnread = 0 }) {
  const inc = { messageCount: 1 };
  if (incAgentUnread) inc.agentUnreadCount = incAgentUnread;
  if (incVisitorUnread) inc.visitorUnreadCount = incVisitorUnread;

  return {
    $set: {
      lastMessage: {
        message: message._id,
        senderType: message.senderType,
        type: message.type,
        preview: buildPreview(message),
        createdAt: message.createdAt,
      },
      lastMessageAt: message.createdAt,
    },
    $inc: inc,
  };
}

/* ------------------------------- agent side ------------------------------- */

/**
 * An agent or owner sends a message.
 *
 * Two rules from the spec meet here:
 *  - the first agent reply implicitly claims an unassigned conversation, and
 *  - an INTERNAL_NOTE is never delivered to the visitor.
 *
 * Internal notes therefore neither claim the conversation nor count as a first
 * response: they are not a reply to the visitor.
 */
async function createAgentMessage({ workspace, actor, member }, conversationId, payload) {
  if (!authorizationService.hasPermission(member, PERMISSIONS.CONVERSATION_REPLY)) {
    throw new ForbiddenError('You cannot reply to conversations', ERROR_CODES.INSUFFICIENT_PERMISSION);
  }

  let conversation = await conversationService.loadConversationOrFail(workspace._id, conversationId);
  if (!authorizationService.canAccessConversation(member, conversation)) {
    throw new ForbiddenError('You cannot access this conversation');
  }

  const type = payload.type === MESSAGE_TYPES.INTERNAL_NOTE ? MESSAGE_TYPES.INTERNAL_NOTE : payload.type;
  const internal = type === MESSAGE_TYPES.INTERNAL_NOTE;

  if (!internal && conversation.status === CONVERSATION_STATUS.CLOSED) {
    throw new BadRequestError('Reopen this conversation before replying to the visitor');
  }

  const attachments = await attachmentService.resolveForMessage(workspace._id, payload.attachmentIds || [], {
    uploadedBy: actor._id,
  });

  const content = cleanText(payload.content || '', { maxLength: 10000 });
  if (!content && !attachments.length) throw new BadRequestError('A message needs text or an attachment');

  // Implicit claim happens BEFORE the message is written, so the assignment is
  // already visible when the message.created event fans out.
  let claimed = null;
  if (!internal) {
    claimed = await assignmentService.autoClaimOnReply({ workspace, actor, conversation });
    if (claimed) conversation = claimed;
  }

  const message = await messageRepository.create({
    workspace: workspace._id,
    conversation: conversation._id,
    senderType: SENDER_TYPES.USER,
    sender: actor._id,
    visitor: conversation.visitor,
    type: resolveType(internal ? MESSAGE_TYPES.INTERNAL_NOTE : type, attachments),
    content,
    attachments: toEmbeddedAttachments(attachments),
    metadata: payload.metadata || {},
    deliveredAt: new Date(),
  });
  const doc = message.toObject();

  await attachmentService.bindToMessage(workspace._id, attachments, {
    conversationId: conversation._id,
    messageId: doc._id,
  });

  await conversationRepository.updateInWorkspace(
    workspace._id,
    conversation._id,
    conversationUpdateForMessage(doc, { incVisitorUnread: internal ? 0 : 1 }),
  );

  // firstResponseAt is set with a conditional update, so it can only ever be
  // written once even under concurrent replies.
  if (!internal) {
    await conversationRepository.setFirstResponse(workspace._id, conversation._id, actor._id, doc.createdAt);
  }

  if (payload.shortcutId) await shortcutService.recordUsage(workspace._id, actor._id, payload.shortcutId);

  const agentPayload = serializeMessage(doc, { sender: actor });

  // Agents (workspace + thread rooms) see everything, including internal notes.
  emitter.toWorkspace(workspace._id, emitter.EVENTS.MESSAGE_CREATED, {
    conversationId: String(conversation._id),
    message: agentPayload,
  });
  emitter.toConversation(conversation._id, emitter.EVENTS.MESSAGE_CREATED, {
    conversationId: String(conversation._id),
    message: agentPayload,
  });

  // The visitor room is only ever given the visitor-safe payload, and internal
  // notes are skipped entirely - visitors never join workspace/thread rooms.
  if (!internal) {
    emitter.toVisitor(conversation.visitor, emitter.EVENTS.MESSAGE_CREATED, {
      conversationId: String(conversation._id),
      message: serializeMessageForVisitor(doc, { sender: actor }),
    });
  }

  return {
    message: agentPayload,
    attachments: attachments.map(serializeAttachment),
    claimed: Boolean(claimed),
  };
}

/* ------------------------------ visitor side ------------------------------ */

/**
 * A visitor sends a message from the widget.
 *
 * The conversation is resolved server-side from the visitor session; the client
 * never supplies workspace, website or widget. A closed conversation is
 * reopened so the visitor can always continue the thread.
 */
async function createVisitorMessage({ workspace, website, widget, visitor }, conversation, payload) {
  let current = conversation;

  if (current.status === CONVERSATION_STATUS.CLOSED) {
    current = (await conversationRepository.reopenIfClosed(workspace._id, current._id)) || current;
  }

  const attachments = await attachmentService.resolveForMessage(workspace._id, payload.attachmentIds || [], {
    uploadedByVisitor: visitor._id,
  });

  const content = cleanText(payload.content || '', { maxLength: 10000 });
  if (!content && !attachments.length) throw new BadRequestError('A message needs text or an attachment');

  const message = await messageRepository.create({
    workspace: workspace._id,
    conversation: current._id,
    senderType: SENDER_TYPES.VISITOR,
    visitor: visitor._id,
    // A visitor can never author an INTERNAL_NOTE: the type is derived here and
    // the request body's type is ignored entirely.
    type: resolveType(null, attachments),
    content,
    attachments: toEmbeddedAttachments(attachments),
    deliveredAt: new Date(),
  });
  const doc = message.toObject();

  await attachmentService.bindToMessage(workspace._id, attachments, {
    conversationId: current._id,
    messageId: doc._id,
  });

  const updated = await conversationRepository.updateInWorkspace(
    workspace._id,
    current._id,
    conversationUpdateForMessage(doc, { incAgentUnread: 1 }),
  );

  const agentPayload = serializeMessage(doc, { visitor });
  emitter.toWorkspace(workspace._id, emitter.EVENTS.MESSAGE_CREATED, {
    conversationId: String(current._id),
    message: agentPayload,
  });
  emitter.toConversation(current._id, emitter.EVENTS.MESSAGE_CREATED, {
    conversationId: String(current._id),
    message: agentPayload,
  });
  // Echo to the visitor's own sockets so other tabs stay in sync.
  emitter.toVisitor(visitor._id, emitter.EVENTS.MESSAGE_CREATED, {
    conversationId: String(current._id),
    message: serializeMessageForVisitor(doc),
  });

  await notifyAgentsOfVisitorMessage({
    workspace,
    website,
    visitor,
    conversation: updated || current,
    message: doc,
  });

  return {
    message: serializeMessageForVisitor(doc),
    attachments: attachments.map(serializeAttachmentForVisitor),
    conversationId: String(current._id),
  };
}

/**
 * Notification fan-out for an inbound visitor message.
 *
 * Assigned conversation -> only the assignee. Unassigned -> every eligible
 * handler, because the conversation is still in the shared queue.
 */
async function notifyAgentsOfVisitorMessage({ workspace, website, visitor, conversation, message }) {
  const preview = buildPreview(message);

  const recipients = conversation.assignedTo
    ? [String(conversation.assignedTo)]
    : await assignmentService.eligibleHandlerIds(workspace._id);
  if (!recipients.length) return;

  const users = await userRepository.findByIds(recipients);

  await notificationService.notify({
    users: recipients,
    workspace: workspace._id,
    type: NOTIFICATION_TYPES.NEW_MESSAGE,
    title: `New message from ${visitor.name || 'a visitor'}`,
    message: preview,
    data: {
      conversationId: String(conversation._id),
      workspaceId: String(workspace._id),
      visitorId: String(visitor._id),
    },
    email: {
      kind: 'new-message',
      to: users.map((u) => u.email).filter(Boolean),
      workspace: { _id: String(workspace._id), name: workspace.name },
      website: website ? { name: website.name } : null,
      visitor: { name: visitor.name || null, email: visitor.email || null },
      conversationId: String(conversation._id),
      preview,
    },
  });
}

/* --------------------------------- reading -------------------------------- */

/** Agent history. Internal notes are included; visitors never reach this path. */
async function listMessages(workspaceId, member, conversationId, query = {}) {
  const conversation = await conversationService.loadConversationOrFail(workspaceId, conversationId);
  if (!authorizationService.canAccessConversation(member, conversation)) {
    throw new ForbiddenError('You cannot access this conversation');
  }

  const { limit, cursor, direction } = parseCursorQuery(query);
  const filter = {
    workspace: workspaceId,
    conversation: conversation._id,
    deletedAt: null,
    ...cursorFilter(cursor, { direction }),
  };
  if (query.type) filter.type = query.type;

  const rows = await messageRepository.findPage(filter, limit);
  const { items, meta } = cursorMeta({ items: rows, limit, direction });

  const senderIds = [...new Set(items.map((m) => m.sender).filter(Boolean).map(String))];
  const visitorIds = [...new Set(items.map((m) => m.visitor).filter(Boolean).map(String))];
  const [senders, visitors] = await Promise.all([
    senderIds.length ? userRepository.findByIds(senderIds) : [],
    visitorIds.length ? visitorRepository.findByIds(workspaceId, visitorIds) : [],
  ]);
  const senderMap = new Map(senders.map((u) => [String(u._id), u]));
  const visitorMap = new Map(visitors.map((v) => [String(v._id), v]));

  return {
    data: items.map((m) =>
      serializeMessage(m, {
        sender: m.sender ? senderMap.get(String(m.sender)) : null,
        visitor: m.visitor ? visitorMap.get(String(m.visitor)) : null,
      }),
    ),
    meta,
  };
}

/**
 * Visitor history.
 *
 * The INTERNAL_NOTE exclusion is applied twice - in the query
 * (`findVisitorPage`) and again in the serializer, which returns null for
 * anything a visitor must not see. Either layer alone would be sufficient;
 * together they make a leak require two independent mistakes.
 */
async function listMessagesForVisitor({ workspace, visitor }, conversation, query = {}) {
  const { limit, cursor, direction } = parseCursorQuery(query);
  const filter = {
    workspace: workspace._id,
    conversation: conversation._id,
    ...cursorFilter(cursor, { direction }),
  };

  const rows = await messageRepository.findVisitorPage(filter, limit);
  const { items, meta } = cursorMeta({ items: rows, limit, direction });

  const senderIds = [...new Set(items.map((m) => m.sender).filter(Boolean).map(String))];
  const senders = senderIds.length ? await userRepository.findByIds(senderIds) : [];
  const senderMap = new Map(senders.map((u) => [String(u._id), u]));

  return {
    data: items
      .map((m) => serializeMessageForVisitor(m, { sender: m.sender ? senderMap.get(String(m.sender)) : null }))
      .filter(Boolean),
    meta,
  };
}

/** Agents may edit their own messages; internal notes included. */
async function editMessage({ workspace, actor, member }, conversationId, messageId, payload) {
  const conversation = await conversationService.loadConversationOrFail(workspace._id, conversationId);
  const existing = await messageRepository.findOneInWorkspace(
    workspace._id,
    requireObjectId(messageId, 'Message'),
  );
  if (!existing || !idEquals(existing.conversation, conversation._id)) {
    throw new NotFoundError('Message not found');
  }
  if (existing.senderType !== SENDER_TYPES.USER || !idEquals(existing.sender, actor._id)) {
    throw new ForbiddenError('You can only edit your own messages');
  }

  const content = cleanText(payload.content, { maxLength: 10000 });
  if (!content) throw new BadRequestError('Message content cannot be empty');

  const updated = await messageRepository.updateInWorkspace(workspace._id, existing._id, {
    $set: { content, editedAt: new Date() },
  });

  const agentPayload = serializeMessage(updated, { sender: actor });
  emitter.toConversation(conversation._id, emitter.EVENTS.MESSAGE_UPDATED, { message: agentPayload });
  emitter.toWorkspace(workspace._id, emitter.EVENTS.MESSAGE_UPDATED, { message: agentPayload });
  if (isVisitorVisible(updated.type)) {
    emitter.toVisitor(conversation.visitor, emitter.EVENTS.MESSAGE_UPDATED, {
      message: serializeMessageForVisitor(updated, { sender: actor }),
    });
  }

  return agentPayload;
}

/** Convenience used by the seed script and the widget bootstrap. */
async function sendWelcomeMessage({ workspace, conversation, widget }) {
  const welcome = ((widget.settings || {}).welcomeMessage || '').trim();
  if (!welcome) return null;
  return conversationService.appendSystemMessage(conversation, welcome, { event: 'widget.welcome' });
}

module.exports = {
  createAgentMessage,
  createVisitorMessage,
  listMessages,
  listMessagesForVisitor,
  editMessage,
  sendWelcomeMessage,
  notifyAgentsOfVisitorMessage,
  isVisitorVisible,
};
