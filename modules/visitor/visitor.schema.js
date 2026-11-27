const Joi = require("../../config/joi");

exports.getVisitorById = Joi.object({
  workspace: Joi.objectId().required(),
  id: Joi.objectId().required(),
});

exports.baseSchema = Joi.object({
  workspace: Joi.objectId(),
  website: Joi.objectId(),
  widget: Joi.objectId().allow(null),
  title: Joi.string().trim().max(120).allow(null),
  email: Joi.string().trim().lowercase().email().max(254).allow(null),
  phone: Joi.string().trim().max(40).allow(null),
  isIdentified: Joi.boolean(),
  currentPage: Joi.string().max(512).allow(null),
  referrer: Joi.string().max(512).allow(null),
  browser: Joi.string().max(40).allow(null),
  operatingSystem: Joi.string().max(40).allow(null),
  device: Joi.string().max(20).allow(null),
  country: Joi.string().length(2).uppercase().allow(null),
  language: Joi.string().max(16).allow(null),
  firstSeenAt: Joi.date(),
  lastSeenAt: Joi.date(),
  lastActiveAt: Joi.date(),
  isOnline: Joi.boolean(),
  sessionCount: Joi.number().integer().min(0),
  metadata: Joi.object().unknown(true).default({}),
});

exports.createVisitor = exports.baseSchema.fork(["workspace", "website"], (schema) => schema.required()).fork("metadata", (schema) => schema.default({}));

exports.updateVisitor = exports.baseSchema.append({ id: Joi.objectId().required() });
