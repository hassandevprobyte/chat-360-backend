const Joi = require("../../config/joi");

// Constants
const { CANNED_RESPONSE } = require("../../common/constants");

exports.getCannedaResponseById = Joi.object({
  workspace: Joi.objectId().required(),
  id: Joi.objectId().required(),
});

exports.baseSchema = Joi.object({
  workspace: Joi.objectId(),
  user: Joi.objectId(),
  title: Joi.string().lowercase().trim().min(2).max(255),
  category: Joi.string()
    .lowercase()
    .trim()
    .valid(...Object.values(CANNED_RESPONSE.CATEGORY)),
  visibility: Joi.string()
    .lowercase()
    .trim()
    .valid(...Object.values(CANNED_RESPONSE.VISIBILITY)),
  tags: Joi.array().items(Joi.string().lowercase().trim().min(2).max(255)).unique().max(10),
  shortcut: Joi.string().lowercase().trim().min(2).max(41).pattern(CANNED_RESPONSE.SHORTCUT_REGEX),
  content: Joi.string().trim().min(1).max(4000).required(),
  isActive: Joi.boolean(),
  usageCount: Joi.number().min(0),
  lastUsedAt: Joi.date(),
});

exports.createCannedResponse = exports.baseSchema
  .fork(["workspace", "user", "shortcut", "content"], (schema) => schema.required())
  .fork("visibility", (schema) => schema.default(CANNED_RESPONSE.VISIBILITY.SHARED))
  .fork("isActive", (schema) => schema.default(true))
  .fork("usageCount", (schema) => schema.default(0));

exports.updateCannedResponse = exports.baseSchema.append({ id: Joi.objectId().required() });
