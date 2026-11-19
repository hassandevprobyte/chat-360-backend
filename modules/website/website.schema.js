const Joi = require("../../config/joi");

// Constants
const { WEBSITE_STATUS, VERIFICATION_STATUS, VERIFICATION_METHODS } = require("../../common/constants");

exports.getWebsiteById = Joi.objectId().required();

exports.baseSchema = Joi.object({
  workspace: Joi.objectId(),
  title: Joi.string().trim().min(1).max(120),
  domain: Joi.string().trim().lowercase().max(253).required(),
  allowedDomains: Joi.array().items(Joi.string().trim().lowercase().max(253)),
  status: Joi.string().valid(...Object.values(WEBSITE_STATUS)),
  verificationStatus: Joi.string().valid(...Object.values(VERIFICATION_STATUS)),
  verificationToken: Joi.string().allow(null),
  verificationMethod: Joi.string()
    .valid(...Object.values(VERIFICATION_METHODS))
    .allow(null),
  verifiedAt: Joi.date().allow(null),
  lastVerificationAttemptAt: Joi.date().allow(null),
  lastVerificationError: Joi.string().max(300).allow(null),
  deletedAt: Joi.date().allow(null),
  settings: Joi.object({
    enforceOriginCheck: Joi.boolean().default(true),
    collectVisitorLocation: Joi.boolean().default(false),
  }),
  metadata: Joi.object().unknown(true).default({}),
});

exports.createWebsite = exports.baseSchema
  .fork(["workspace", "title", "domain"], (schema) => schema.required())
  .fork(["status", "verificationStatus", "verificationToken", "verificationMethod", "verifiedAt", "lastVerificationAttemptAt", "lastVerificationError", "deletedAt"], (schema) =>
    schema.strip(),
  )
  .fork("metadata", (schema) => schema.default({}));

exports.updateWebsite = exports.baseSchema
  .append({ id: Joi.objectId().required() })
  .fork(["workspace", "verificationStatus", "verificationToken", "verificationMethod", "verifiedAt", "lastVerificationAttemptAt", "lastVerificationError", "deletedAt"], (schema) =>
    schema.strip(),
  );
