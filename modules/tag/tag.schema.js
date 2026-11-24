const Joi = require("../../config/joi");

// Constants
const { COLORS } = require("../../common/constants");

exports.getTagById = Joi.object({
  workspace: Joi.objectId().required(),
  id: Joi.objectId().required(),
});

exports.baseSchema = Joi.object({
  workspace: Joi.objectId(),
  title: Joi.string().trim().lowercase().min(2).max(40),
  titleKey: Joi.string().trim().lowercase().min(3).max(41),
  color: Joi.string().valid(...Object.values(COLORS)),
  description: Joi.string().trim().lowercase().min(0).max(500),
  isActive: Joi.boolean(),
  createdBy: Joi.objectId(),
  metadata: Joi.object().unknown(true),
});

exports.createTag = exports.baseSchema
  .fork(["workspace", "title", "createdBy"], (schema) => schema.required())
  .fork("isActive", (schema) => schema.default(true))
  .fork("color", (schema) => schema.default(COLORS.GRAY))
  .fork("metadata", (schema) => schema.default({}));

exports.updateTag = exports.baseSchema.append({ id: Joi.objectId().required() }).fork("createdBy", (schema) => schema.strip());
