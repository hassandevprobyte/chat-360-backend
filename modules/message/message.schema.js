const Joi = require("../../config/joi");

// Constants
const { SENDER_TYPES, MESSAGE_TYPES } = require("../../common/constants");

exports.getMessageById = Joi.objectId().required();

exports.baseSchema = Joi.object({
  workspace: Joi.objectId(),
  conversation: Joi.objectId(),
  senderType: Joi.string().valid(...Object.values(SENDER_TYPES)),
  sender: Joi.objectId().allow(null),
  visitor: Joi.objectId().allow(null),
  type: Joi.string().valid(...Object.values(MESSAGE_TYPES)),
  content: Joi.string().max(10000),
  attachments: Joi.array().items(Joi.objectId()),
  deliveredAt: Joi.date().allow(null),
  readAt: Joi.date().allow(null),
  editedAt: Joi.date().allow(null),
  deletedAt: Joi.date().allow(null),
  metadata: Joi.object().unknown(true).default({}),
});

exports.createMessage = exports.baseSchema
  .fork(["workspace", "conversation", "senderType"], (schema) => schema.required())
  .fork("type", (schema) => schema.default(MESSAGE_TYPES.TEXT))
  .fork("content", (schema) => schema.default(""))
  .fork("attachments", (schema) => schema.default([]))
  .fork("metadata", (schema) => schema.default({}));

exports.updateMessage = exports.baseSchema.append({
  id: Joi.objectId().required(),
});
