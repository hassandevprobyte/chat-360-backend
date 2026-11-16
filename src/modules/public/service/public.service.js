'use strict';

const { NotFoundError, BadRequestError } = require('../../../common/errors');
const { requireObjectId, idEquals } = require('../../../common/utils/objectId');
const tokenService = require('../../auth/service/token.service');
const widgetCacheService = require('../../widgets/service/widgetCache.service');
const { serializePublicWidgetConfig } = require('../../widgets/serializer');
const visitorService = require('../../visitors/service/visitor.service');
const { serializeSelfVisitor } = require('../../visitors/serializer');
const conversationService = require('../../conversations/service/conversation.service');
const conversationRepository = require('../../conversations/repository/conversation.repository');
const assignmentService = require('../../conversations/service/assignment.service');
const messageService = require('../../messages/service/message.service');
const attachmentService = require('../../attachments/service/attachment.service');
const { serializeAttachmentForVisitor } = require('../../attachments/serializer');
const { serializeConversationForVisitor } = require('../../conversations/serializer');
const userRepository = require('../../users/repository/user.repository');
const presence = require('../../../realtime/presence');
const { buildPreview } = require('../../messages/serializer');
const widgetContext = require('./widgetContext.service');

/**
 * Public widget API.
 *
 * Everything here runs either unauthenticated (config, init) or under a visitor
 * session. The rules are simple and enforced in one place:
 *  - only whitelisted, visitor-safe payloads are returned;
 *  - every conversation access is checked against `conversation.visitor`;
 *  - the tenant is always derived from the widget/token, never from the body.
 */

/* ---------------------------------- config -------------------------------- */

async function getWidgetConfig(publicKey, req) {
  let cached = await widgetCacheService.get(publicKey);

  if (!cached) {
    const { widget, website } = await widgetContext.resolveByPublicKey(publicKey);
    cached = {
      config: serializePublicWidgetConfig(widget, { website }),
      // Just enough of the website to run the origin check on a cache hit.
      workspaceId: String(widget.workspace),
      website: {
        domain: website.domain,
        allowedDomains: website.allowedDomains || [],
        settings: { enforceOriginCheck: (website.settings || {}).enforceOriginCheck },
      },
    };
    await widgetCacheService.set(publicKey, cached);
  }

  widgetContext.assertOriginAllowed(cached.website, req);

  // Availability is live (presence TTL) and is never stored with the config.
  const agentsOnline = await presence.countOnlineAgents(cached.workspaceId).catch(() => 0);
  return { ...cached.config, availability: { isOnline: agentsOnline > 0, agentsOnline } };
}

/* ---------------------------------- visitor ------------------------------- */

async function initVisitor(publicKey, body, req) {
  const { widget, website, workspace } = await widgetContext.resolveByPublicKey(publicKey);
  widgetContext.assertOriginAllowed(website, req);

  const visitor = await visitorService.initVisitor({
    workspace,
    website,
    widget,
    anonymousId: body.anonymousId,
    req,
    page: body.page,
    referrer: body.referrer,
    language: body.language,
  });

  const visitorToken = tokenService.signVisitorToken({
    visitorId: visitor._id,
    workspaceId: workspace._id,
    websiteId: website._id,
    widgetId: widget._id,
    anonymousId: visitor.anonymousId,
  });

  const active = await conversationRepository.findActiveForVisitor(workspace._id, visitor._id);

  return {
    visitorToken,
    visitor: serializeSelfVisitor(visitor),
    activeConversation: active ? await visitorConversationPayload(workspace._id, active) : null,
  };
}

const identify = (ctx, body) => visitorService.identifyVisitor(ctx.workspace._id, ctx.visitor._id, body);

const activity = (ctx, body) => visitorService.trackActivity(ctx.workspace._id, ctx.visitor._id, body);

const leave = async (ctx) => {
  await visitorService.markOffline(ctx.workspace._id, ctx.visitor._id);
  return { ok: true };
};

/* ------------------------------- conversations ---------------------------- */

async function visitorConversationPayload(workspaceId, conversation) {
  const assignee = conversation.assignedTo ? await userRepository.findById(conversation.assignedTo) : null;
  return serializeConversationForVisitor(conversation, { assignedTo: assignee });
}

async function loadOwnConversation(ctx, conversationId) {
  const conversation = await conversationRepository.findOneInWorkspace(
    ctx.workspace._id,
    requireObjectId(conversationId, 'Conversation'),
  );
  // A conversation belonging to another visitor is reported as missing.
  if (!conversation || !idEquals(conversation.visitor, ctx.visitor._id)) {
    throw new NotFoundError('Conversation not found');
  }
  return conversation;
}

const listConversations = (ctx, query) => conversationService.listForVisitor(ctx, query);

/**
 * Starts a conversation (or continues the visitor's open one) with an initial
 * message. The new conversation enters the unassigned queue and every eligible
 * agent is notified.
 */
async function startConversation(ctx, body, req) {
  const { workspace, website, widget, visitor } = ctx;
  if (!body.content && !(body.attachmentIds || []).length) {
    throw new BadRequestError('A first message is required to start a conversation');
  }

  if (body.visitor) {
    // Pre-chat form values ride along with the first message.
    await visitorService.identifyVisitor(workspace._id, visitor._id, body.visitor);
  }

  const { conversation, created } = await conversationService.getOrCreateForVisitor({
    workspace,
    website,
    widget,
    visitor,
    page: body.page || (req && req.get('referer')),
    subject: body.subject,
  });

  const sent = await messageService.createVisitorMessage({ workspace, website, widget, visitor }, conversation, {
    content: body.content,
    attachmentIds: body.attachmentIds,
  });

  if (created) {
    // announceUnassignedConversation covers the queue broadcast + notifications
    // for brand-new conversations; createVisitorMessage already notified for
    // the message itself, so only the conversation-level announcement is added.
    const fresh = await conversationRepository.findOneInWorkspace(workspace._id, conversation._id);
    await assignmentService.announceUnassignedConversation({
      workspace,
      conversation: fresh,
      website,
      visitor,
      preview: buildPreview({ content: body.content, attachments: [] }),
    });
  }

  const fresh = await conversationRepository.findOneInWorkspace(workspace._id, conversation._id);
  return {
    conversation: await visitorConversationPayload(workspace._id, fresh),
    message: sent.message,
    created,
  };
}

async function getConversation(ctx, conversationId) {
  const conversation = await loadOwnConversation(ctx, conversationId);
  return visitorConversationPayload(ctx.workspace._id, conversation);
}

async function listMessages(ctx, conversationId, query) {
  const conversation = await loadOwnConversation(ctx, conversationId);
  return messageService.listMessagesForVisitor(ctx, conversation, query);
}

async function sendMessage(ctx, conversationId, body) {
  const conversation = await loadOwnConversation(ctx, conversationId);
  return messageService.createVisitorMessage(ctx, conversation, body);
}

const markRead = (ctx, conversationId) => conversationService.markReadByVisitor(ctx, conversationId);

const closeConversation = (ctx, conversationId) => conversationService.closeByVisitor(ctx, conversationId);

/* -------------------------------- attachments ----------------------------- */

async function uploadAttachment(ctx, file, conversationId) {
  if (!(ctx.widget.settings || {}).fileUploadEnabled) {
    throw new BadRequestError('File uploads are disabled for this widget');
  }
  const conversation = conversationId ? await loadOwnConversation(ctx, conversationId) : null;
  const attachment = await attachmentService.upload({
    workspace: ctx.workspace,
    file,
    uploadedByVisitor: ctx.visitor._id,
    conversation,
  });
  return serializeAttachmentForVisitor(attachment);
}

async function downloadAttachment(ctx, attachmentId) {
  const attachment = await attachmentService.getForVisitor(ctx, attachmentId);
  return attachmentService.openDownload(attachment);
}

module.exports = {
  getWidgetConfig,
  initVisitor,
  identify,
  activity,
  leave,
  listConversations,
  startConversation,
  getConversation,
  listMessages,
  sendMessage,
  markRead,
  closeConversation,
  uploadAttachment,
  downloadAttachment,
};
