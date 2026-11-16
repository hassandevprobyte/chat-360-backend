'use strict';

const {
  CONVERSATION_STATUS,
  SENDER_TYPES,
  MESSAGE_TYPES,
  AUDIT_ACTIONS,
  ERROR_CODES,
  PERMISSIONS,
} = require('../../../common/constants');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../../../common/errors');
const { parseCursorQuery, cursorFilter, cursorMeta } = require('../../../common/utils/pagination');
const { requireObjectId, idEquals } = require('../../../common/utils/objectId');
const { cleanText, safePageUrl } = require('../../../common/utils/sanitize');
const conversationRepository = require('../repository/conversation.repository');
const messageRepository = require('../../messages/repository/message.repository');
const websiteRepository = require('../../websites/repository/website.repository');
const visitorRepository = require('../../visitors/repository/visitor.repository');
const tagService = require('../../tags/service/tag.service');
const authorizationService = require('../../workspaces/service/authorization.service');
const auditLogService = require('../../auditLogs/service/auditLog.service');
const emitter = require('../../../realtime/emitter');
const assignmentService = require('./assignment.service');
const { hydrateConversation, hydrateConversations } = require('./hydrate.service');
const { serializeConversationForVisitor } = require('../serializer');
const { buildPreview } = require('../../messages/serializer');

const SORT_FIELD = 'lastMessageAt';

/* --------------------------------- reading -------------------------------- */

/**
 * Builds the inbox filter from query params.
 *
 * `workspace` always comes from the resolved membership, never the query, so
 * there is no way to widen the filter across tenants.
 */
function buildListFilter(workspaceId, member, query = {}) {
  const filter = { workspace: workspaceId };

  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.websiteId) filter.website = requireObjectId(query.websiteId, 'Website');
  if (query.widgetId) filter.widget = requireObjectId(query.widgetId, 'Widget');
  if (query.visitorId) filter.visitor = requireObjectId(query.visitorId, 'Visitor');
  if (query.tagId) filter.tags = requireObjectId(query.tagId, 'Tag');

  switch (query.assigned) {
    case 'me':
      filter.assignedTo = member.user;
      break;
    case 'unassigned':
      filter.assignedTo = null;
      break;
    case 'assigned':
      filter.assignedTo = { $ne: null };
      break;
    default:
      if (query.assignedTo) filter.assignedTo = requireObjectId(query.assignedTo, 'User');
  }

  return filter;
}

async function listConversations(workspaceId, member, query = {}) {
  if (!authorizationService.canHandleConversations(member)) {
    throw new ForbiddenError('Your role cannot view conversations', ERROR_CODES.INSUFFICIENT_ROLE);
  }

  const { limit, cursor, direction } = parseCursorQuery(query);
  const filter = {
    ...buildListFilter(workspaceId, member, query),
    ...cursorFilter(cursor, { field: SORT_FIELD, direction }),
  };

  const rows = await conversationRepository.findPage(filter, limit);
  const { items, meta } = cursorMeta({ items: rows, limit, field: SORT_FIELD, direction });
  return { data: await hydrateConversations(workspaceId, items), meta };
}

/** The unassigned queue: visible to every eligible member of the workspace. */
const listUnassigned = (workspaceId, member, query = {}) =>
  listConversations(workspaceId, member, { ...query, assigned: 'unassigned', assignedTo: undefined });

async function loadConversationOrFail(workspaceId, conversationId) {
  const conversation = await conversationRepository.findOneInWorkspace(
    workspaceId,
    requireObjectId(conversationId, 'Conversation'),
  );
  if (!conversation) throw new NotFoundError('Conversation not found');
  return conversation;
}

async function getConversation(workspaceId, member, conversationId) {
  const conversation = await loadConversationOrFail(workspaceId, conversationId);
  if (!authorizationService.canAccessConversation(member, conversation)) {
    throw new ForbiddenError('You cannot access this conversation');
  }

  const [payload, website, messageCount] = await Promise.all([
    hydrateConversation(workspaceId, conversation),
    websiteRepository.findOneInWorkspace(workspaceId, conversation.website),
    messageRepository.countDocuments({ workspace: workspaceId, conversation: conversation._id }),
  ]);

  return {
    ...payload,
    website: website ? { id: String(website._id), name: website.name, domain: website.domain } : null,
    messageCount,
  };
}

/* --------------------------------- writing -------------------------------- */

/**
 * Creates a conversation from the widget.
 *
 * assignedTo is always null: new conversations enter the unassigned queue and
 * are pulled by an agent. Workspace/website/widget/visitor all come from the
 * server-resolved widget context.
 */
async function createFromWidget({ workspace, website, widget, visitor, page, subject }) {
  const conversation = await conversationRepository.create({
    workspace: workspace._id,
    website: website._id,
    widget: widget._id,
    visitor: visitor._id,
    assignedTo: null,
    status: CONVERSATION_STATUS.OPEN,
    subject: subject ? cleanText(subject, { maxLength: 160 }) : null,
    startedPage: page ? safePageUrl(page) : visitor.currentPage || null,
    lastMessageAt: new Date(),
  });

  return conversation.toObject();
}

/** Reuses the visitor's open conversation when one exists. */
async function getOrCreateForVisitor(ctx) {
  const existing = await conversationRepository.findActiveForVisitor(ctx.workspace._id, ctx.visitor._id);
  if (existing) return { conversation: existing, created: false };
  const conversation = await createFromWidget(ctx);
  return { conversation, created: true };
}

/** System messages narrate lifecycle changes inside the thread. */
async function appendSystemMessage(conversation, content, metadata = {}) {
  const message = await messageRepository.create({
    workspace: conversation.workspace,
    conversation: conversation._id,
    senderType: SENDER_TYPES.SYSTEM,
    type: MESSAGE_TYPES.SYSTEM,
    visitor: conversation.visitor,
    content,
    metadata,
  });

  const doc = message.toObject();
  await conversationRepository.updateInWorkspace(conversation.workspace, conversation._id, {
    $set: {
      lastMessage: {
        message: doc._id,
        senderType: doc.senderType,
        type: doc.type,
        preview: buildPreview(doc),
        createdAt: doc.createdAt,
      },
      lastMessageAt: doc.createdAt,
    },
    $inc: { messageCount: 1 },
  });

  return doc;
}

async function closeConversation({ workspace, actor, member }, conversationId, { reason } = {}) {
  const existing = await loadConversationOrFail(workspace._id, conversationId);

  if (!authorizationService.canCloseConversation(member, existing, workspace.settings || {})) {
    throw new ForbiddenError('You cannot close this conversation', ERROR_CODES.INSUFFICIENT_PERMISSION);
  }

  const closed = await conversationRepository.closeIfOpen(workspace._id, existing._id, actor._id);
  if (!closed) {
    // Already closed - idempotent, not an error.
    return { conversation: await hydrateConversation(workspace._id, existing), changed: false };
  }

  const systemMessage = await appendSystemMessage(closed, `${actor.name} closed this conversation`, {
    event: 'conversation.closed',
    reason: reason ? cleanText(reason, { maxLength: 200 }) : null,
  });

  const conversation = await hydrateConversation(workspace._id, closed);
  const payload = { conversationId: String(closed._id), closedBy: String(actor._id), conversation };

  emitter.toWorkspace(workspace._id, emitter.EVENTS.CONVERSATION_CLOSED, payload);
  emitter.toConversation(closed._id, emitter.EVENTS.CONVERSATION_CLOSED, payload);
  // The visitor learns the chat ended, but nothing about who closed it.
  emitter.toVisitor(closed.visitor, emitter.EVENTS.CONVERSATION_CLOSED, {
    conversation: serializeConversationForVisitor(closed),
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.CONVERSATION_CLOSED,
    resource: 'conversation',
    resourceId: closed._id,
    metadata: { systemMessageId: String(systemMessage._id) },
  });

  return { conversation, changed: true };
}

async function reopenConversation({ workspace, actor, member }, conversationId) {
  const existing = await loadConversationOrFail(workspace._id, conversationId);
  if (!authorizationService.canCloseConversation(member, existing, workspace.settings || {})) {
    throw new ForbiddenError('You cannot reopen this conversation', ERROR_CODES.INSUFFICIENT_PERMISSION);
  }

  const reopened = await conversationRepository.reopenIfClosed(workspace._id, existing._id);
  if (!reopened) {
    return { conversation: await hydrateConversation(workspace._id, existing), changed: false };
  }

  await appendSystemMessage(reopened, `${actor.name} reopened this conversation`, {
    event: 'conversation.reopened',
  });

  const conversation = await hydrateConversation(workspace._id, reopened);
  const payload = { conversationId: String(reopened._id), conversation };

  emitter.toWorkspace(workspace._id, emitter.EVENTS.CONVERSATION_REOPENED, payload);
  emitter.toConversation(reopened._id, emitter.EVENTS.CONVERSATION_REOPENED, payload);
  emitter.toVisitor(reopened.visitor, emitter.EVENTS.CONVERSATION_REOPENED, {
    conversation: serializeConversationForVisitor(reopened),
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.CONVERSATION_REOPENED,
    resource: 'conversation',
    resourceId: reopened._id,
    metadata: {},
  });

  return { conversation, changed: true };
}

/** Visitor-initiated close from the widget. No agent identity involved. */
async function closeByVisitor({ workspace, visitor }, conversationId) {
  const existing = await loadConversationOrFail(workspace._id, conversationId);
  if (!idEquals(existing.visitor, visitor._id)) throw new NotFoundError('Conversation not found');

  const closed = await conversationRepository.closeIfOpen(workspace._id, existing._id, null);
  if (!closed) return serializeConversationForVisitor(existing);

  await appendSystemMessage(closed, 'The visitor ended this conversation', {
    event: 'conversation.closed',
    by: 'VISITOR',
  });

  const conversation = await hydrateConversation(workspace._id, closed);
  emitter.toWorkspace(workspace._id, emitter.EVENTS.CONVERSATION_CLOSED, {
    conversationId: String(closed._id),
    closedByVisitor: true,
    conversation,
  });
  emitter.toConversation(closed._id, emitter.EVENTS.CONVERSATION_CLOSED, {
    conversationId: String(closed._id),
    closedByVisitor: true,
  });

  return serializeConversationForVisitor(closed);
}

async function updateConversation({ workspace, actor, member }, conversationId, payload) {
  const existing = await loadConversationOrFail(workspace._id, conversationId);
  if (!authorizationService.canAccessConversation(member, existing)) {
    throw new ForbiddenError('You cannot modify this conversation');
  }

  const update = {};
  if (payload.priority !== undefined) update.priority = payload.priority;
  if (payload.subject !== undefined) {
    update.subject = payload.subject ? cleanText(payload.subject, { maxLength: 160 }) : null;
  }
  if (payload.status !== undefined && payload.status !== existing.status) {
    // Status changes go through close/reopen so the side effects always run.
    throw new BadRequestError('Use the close/reopen endpoints to change conversation status');
  }
  if (!Object.keys(update).length) throw new BadRequestError('No changes supplied');

  const updated = await conversationRepository.updateInWorkspace(workspace._id, existing._id, { $set: update });
  const conversation = await hydrateConversation(workspace._id, updated);

  emitter.toWorkspace(workspace._id, emitter.EVENTS.CONVERSATION_UPDATED, {
    conversationId: String(existing._id),
    conversation,
  });

  return conversation;
}

/**
 * Tag application. AGENTs may apply and remove existing tags; creating the tag
 * catalogue is a TAG_MANAGE (OWNER) action handled by the tags module.
 */
async function setTags({ workspace, actor, member }, conversationId, tagIds) {
  if (!authorizationService.hasPermission(member, PERMISSIONS.CONVERSATION_TAG)) {
    throw new ForbiddenError('You cannot change tags on conversations', ERROR_CODES.INSUFFICIENT_PERMISSION);
  }

  const existing = await loadConversationOrFail(workspace._id, conversationId);
  const tags = await tagService.resolveWorkspaceTags(workspace._id, tagIds);

  const updated = await conversationRepository.updateInWorkspace(workspace._id, existing._id, {
    $set: { tags: tags.map((t) => t._id) },
  });
  const conversation = await hydrateConversation(workspace._id, updated);

  emitter.toWorkspace(workspace._id, emitter.EVENTS.CONVERSATION_UPDATED, {
    conversationId: String(existing._id),
    conversation,
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.CONVERSATION_TAGS_CHANGED,
    resource: 'conversation',
    resourceId: existing._id,
    metadata: { tags: tags.map((t) => t.name) },
  });

  return conversation;
}

const addTag = async (ctx, conversationId, tagId) => {
  const existing = await loadConversationOrFail(ctx.workspace._id, conversationId);
  const next = [...new Set([...(existing.tags || []).map(String), String(tagId)])];
  return setTags(ctx, conversationId, next);
};

const removeTag = async (ctx, conversationId, tagId) => {
  const existing = await loadConversationOrFail(ctx.workspace._id, conversationId);
  const next = (existing.tags || []).map(String).filter((t) => t !== String(tagId));
  return setTags(ctx, conversationId, next);
};

/** Agent side read receipt: clears the agent unread counter for the thread. */
async function markReadByAgent({ workspace, actor, member }, conversationId) {
  const existing = await loadConversationOrFail(workspace._id, conversationId);
  if (!authorizationService.canAccessConversation(member, existing)) {
    throw new ForbiddenError('You cannot access this conversation');
  }

  const at = new Date();
  await messageRepository.markRead(workspace._id, existing._id, [SENDER_TYPES.VISITOR], at);
  await conversationRepository.updateInWorkspace(workspace._id, existing._id, {
    $set: { agentUnreadCount: 0, agentLastReadAt: at },
  });

  const payload = { conversationId: String(existing._id), readerType: 'USER', readerId: String(actor._id), at };
  emitter.toConversation(existing._id, emitter.EVENTS.MESSAGE_READ, payload);
  emitter.toWorkspace(workspace._id, emitter.EVENTS.MESSAGE_READ, payload);
  // The visitor may render "seen" for their own messages.
  emitter.toVisitor(existing.visitor, emitter.EVENTS.MESSAGE_READ, {
    conversationId: String(existing._id),
    readerType: 'AGENT',
    at,
  });

  return { read: true, at };
}

/** Visitor side read receipt, called from the widget. */
async function markReadByVisitor({ workspace, visitor }, conversationId) {
  const existing = await loadConversationOrFail(workspace._id, conversationId);
  if (!idEquals(existing.visitor, visitor._id)) throw new NotFoundError('Conversation not found');

  const at = new Date();
  await messageRepository.markRead(workspace._id, existing._id, [SENDER_TYPES.USER, SENDER_TYPES.SYSTEM], at);
  await conversationRepository.updateInWorkspace(workspace._id, existing._id, {
    $set: { visitorUnreadCount: 0, visitorLastReadAt: at },
  });

  const payload = { conversationId: String(existing._id), readerType: 'VISITOR', at };
  emitter.toConversation(existing._id, emitter.EVENTS.MESSAGE_READ, payload);
  emitter.toWorkspace(workspace._id, emitter.EVENTS.MESSAGE_READ, payload);

  return { read: true, at };
}

/** Counters for the inbox header. */
async function getInboxCounts(workspaceId, member) {
  const [unassigned, mine, open, closed] = await Promise.all([
    conversationRepository.countDocuments({
      workspace: workspaceId,
      assignedTo: null,
      status: { $ne: CONVERSATION_STATUS.CLOSED },
    }),
    conversationRepository.countDocuments({
      workspace: workspaceId,
      assignedTo: member.user,
      status: { $ne: CONVERSATION_STATUS.CLOSED },
    }),
    conversationRepository.countDocuments({ workspace: workspaceId, status: CONVERSATION_STATUS.OPEN }),
    conversationRepository.countDocuments({ workspace: workspaceId, status: CONVERSATION_STATUS.CLOSED }),
  ]);
  return { unassigned, assignedToMe: mine, open, closed };
}

/** Visitor-facing conversation list for the widget. */
async function listForVisitor({ workspace, visitor }, query = {}) {
  const { limit, cursor, direction } = parseCursorQuery(query);
  const filter = {
    workspace: workspace._id,
    visitor: visitor._id,
    ...cursorFilter(cursor, { field: SORT_FIELD, direction }),
  };

  const rows = await conversationRepository.findPage(filter, limit);
  const { items, meta } = cursorMeta({ items: rows, limit, field: SORT_FIELD, direction });

  const assignees = await hydrateConversations(workspace._id, items);
  return {
    data: items.map((conversation, index) =>
      serializeConversationForVisitor(conversation, {
        assignedTo: assignees[index] && assignees[index].assignedTo
          ? { name: assignees[index].assignedTo.name, avatar: assignees[index].assignedTo.avatar }
          : null,
      }),
    ),
    meta,
  };
}

module.exports = {
  CONVERSATION_STATUS,
  buildListFilter,
  listConversations,
  listUnassigned,
  getConversation,
  loadConversationOrFail,
  createFromWidget,
  getOrCreateForVisitor,
  appendSystemMessage,
  closeConversation,
  reopenConversation,
  closeByVisitor,
  updateConversation,
  setTags,
  addTag,
  removeTag,
  markReadByAgent,
  markReadByVisitor,
  getInboxCounts,
  listForVisitor,
  claim: assignmentService.claim,
  assignToUser: assignmentService.assignToUser,
  unassign: assignmentService.unassign,
};
