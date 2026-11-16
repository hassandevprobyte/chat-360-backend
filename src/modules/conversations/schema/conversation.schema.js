'use strict';

const Joi = require('joi');
const {
  CONVERSATION_STATUS,
  CONVERSATION_PRIORITY,
  MESSAGE_TYPES,
} = require('../../../common/constants');
const {
  objectId,
  cursorQuery,
  metadata,
  workspaceParams,
  workspaceScopedParams,
} = require('../../../common/validators/common.validators');

const listConversations = {
  params: workspaceParams,
  query: cursorQuery.keys({
    status: Joi.string().valid(...Object.values(CONVERSATION_STATUS)),
    priority: Joi.string().valid(...Object.values(CONVERSATION_PRIORITY)),
    assigned: Joi.string().valid('me', 'unassigned', 'assigned'),
    assignedTo: objectId,
    websiteId: objectId,
    widgetId: objectId,
    visitorId: objectId,
    tagId: objectId,
  }),
};

const conversationParams = { params: workspaceScopedParams('conversationId') };

const updateConversation = {
  params: workspaceScopedParams('conversationId'),
  body: Joi.object({
    priority: Joi.string().valid(...Object.values(CONVERSATION_PRIORITY)),
    subject: Joi.string().trim().max(160).allow('', null),
  }).min(1),
};

const assignConversation = {
  params: workspaceScopedParams('conversationId'),
  body: Joi.object({ userId: objectId.required() }),
};

const closeConversation = {
  params: workspaceScopedParams('conversationId'),
  body: Joi.object({ reason: Joi.string().trim().max(200).allow('', null) }).default({}),
};

const setTags = {
  params: workspaceScopedParams('conversationId'),
  body: Joi.object({ tagIds: Joi.array().items(objectId).max(20).required() }),
};

const conversationTagParams = {
  params: Joi.object({
    workspaceId: objectId.required(),
    conversationId: objectId.required(),
    tagId: objectId.required(),
  }),
};

const listMessages = {
  params: workspaceScopedParams('conversationId'),
  query: cursorQuery.keys({ type: Joi.string().valid(...Object.values(MESSAGE_TYPES)) }),
};

/**
 * Agents may send TEXT, IMAGE, FILE or INTERNAL_NOTE. SYSTEM is excluded: only
 * the server writes system messages.
 */
const sendMessage = {
  params: workspaceScopedParams('conversationId'),
  body: Joi.object({
    content: Joi.string().trim().max(10000).allow('').default(''),
    type: Joi.string()
      .valid(MESSAGE_TYPES.TEXT, MESSAGE_TYPES.IMAGE, MESSAGE_TYPES.FILE, MESSAGE_TYPES.INTERNAL_NOTE)
      .default(MESSAGE_TYPES.TEXT),
    attachmentIds: Joi.array().items(objectId).max(10).default([]),
    // Telemetry only: the content has already been inserted in the composer and
    // possibly edited by the agent before sending.
    shortcutId: objectId,
    metadata,
  }).or('content', 'attachmentIds'),
};

const editMessage = {
  params: Joi.object({
    workspaceId: objectId.required(),
    conversationId: objectId.required(),
    messageId: objectId.required(),
  }),
  body: Joi.object({ content: Joi.string().trim().min(1).max(10000).required() }),
};

module.exports = {
  listConversations,
  conversationParams,
  updateConversation,
  assignConversation,
  closeConversation,
  setTags,
  conversationTagParams,
  listMessages,
  sendMessage,
  editMessage,
};
