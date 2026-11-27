const Joi = require("../../config/joi");

// Constants
const { COLORS, CURRENCY, LOCALES, STATUSES, TIMEZONE, WORKSPACE, WORKSPACE_ROLES } = require("../../common/constants");

// Environment Variables
const { env } = require("../../config");

exports.getWorkspaceById = Joi.objectId().required();

exports.getWorkspaceBySlug = Joi.string().trim().length(env.WORKSPACE.SLUG_LENGTH).required();

exports.baseSchema = Joi.object({
  user: Joi.objectId(),
  title: Joi.string().trim().lowercase(),
  email: Joi.string().email(),
  website: Joi.string().uri(),
  industry: Joi.string().valid(...Object.values(WORKSPACE.INDUSTRY)),
  companySize: Joi.string().valid(...Object.values(WORKSPACE.COMPANY_SIZE)),
  description: Joi.string().trim().lowercase().allow(""),
  status: Joi.string()
    .trim()
    .valid(...Object.values(STATUSES.WORKSPACE))
    .default(STATUSES.WORKSPACE.ACTIVE),
  agents: Joi.array()
    .items(
      Joi.object({
        user: Joi.objectId().required(),
        role: Joi.string()
          .valid(...Object.values(WORKSPACE_ROLES))
          .required(),
        assignedAt: Joi.date(),
      }),
    )
    .unique("user"),
  settings: Joi.object({
    color: Joi.string()
      .trim()
      .valid(...Object.values(COLORS)),
    timezone: Joi.string().valid(...Object.values(TIMEZONE)),
    currency: Joi.string().valid(...Object.values(CURRENCY)),
    locale: Joi.string().valid(...Object.values(LOCALES)),
    allowedIPs: Joi.array().items(Joi.string().ip({ version: ["ipv4", "ipv6"] })),
  }),
});

exports.createWorkspace = exports.baseSchema
  .fork(["user"], (field) => field.required())
  .fork("title", (schema) => schema.default("untitled"))
  .fork("settings.color", (schema) => schema.default(COLORS.GRAY))
  .fork("settings.timezone", (schema) => schema.default(TIMEZONE.UTC))
  .fork("settings.currency", (schema) => schema.default(CURRENCY.USD))
  .fork("settings.locale", (schema) => schema.default(LOCALES.EN_US));

exports.updateWorkspace = exports.baseSchema.append({ id: Joi.objectId().required() });
