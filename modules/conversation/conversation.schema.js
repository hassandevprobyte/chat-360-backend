const Joi = require("../../config/joi");

// Constants
const { CONVERSATION_STATUS, CONVERSATION_PRIORITY } = require("../../common/constants");

exports.getConversationById = Joi.objectId().required();

exports.baseSchema = Joi.object({
  workspace: Joi.objectId(),
  website: Joi.objectId(),
  widget: Joi.objectId(),
  visitor: Joi.objectId(),
  assignedTo: Joi.objectId().allow(null),
  assignedAt: Joi.date().allow(null),
  status: Joi.string().valid(...Object.values(CONVERSATION_STATUS)),
  priority: Joi.string().valid(...Object.values(CONVERSATION_PRIORITY)),
  subject: Joi.string().max(160).allow(null),
  tags: Joi.array().items(Joi.objectId()),
  lastMessage: Joi.object({
    message: Joi.objectId().allow(null),
    senderType: Joi.string().allow(null),
    type: Joi.string().allow(null),
    preview: Joi.string().max(200).allow(null),
    createdAt: Joi.date().allow(null),
  }),
  lastMessageAt: Joi.date(),
  firstResponseAt: Joi.date().allow(null),
  firstAgentReplyBy: Joi.objectId().allow(null),
  closedAt: Joi.date().allow(null),
  closedBy: Joi.objectId().allow(null),
  reopenedAt: Joi.date().allow(null),
  messageCount: Joi.number().integer().min(0),
  visitorUnreadCount: Joi.number().integer().min(0),
  agentUnreadCount: Joi.number().integer().min(0),
  visitorLastReadAt: Joi.date().allow(null),
  agentLastReadAt: Joi.date().allow(null),
  startedPage: Joi.string().max(512).allow(null),
  metadata: Joi.object().unknown(true).default({}),
});

exports.createConversation = exports.baseSchema
  .fork(["workspace", "website", "widget", "visitor"], (schema) => schema.required())
  .fork("status", (schema) => schema.default(CONVERSATION_STATUS.OPEN))
  .fork("priority", (schema) => schema.default(CONVERSATION_PRIORITY.NORMAL))
  .fork("tags", (schema) => schema.default([]))
  .fork("lastMessage", (schema) => schema.strip())
  .fork("metadata", (schema) => schema.default({}));

exports.updateConversation = exports.baseSchema.append({ id: Joi.objectId().required() });
