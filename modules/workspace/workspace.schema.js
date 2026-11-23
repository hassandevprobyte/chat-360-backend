const Joi = require("../../config/joi");

// Constants
const { COLORS, CURRENCY, LOCALES, STATUSES, TIMEZONE } = require("../../common/constants");

// Environment Variables
const { env } = require("../../config");

exports.getWorkspaceById = Joi.objectId().required();

exports.getWorkspaceBySlug = Joi.string().trim().length(env.WORKSPACE.SLUG_LENGTH).required();

exports.baseSchema = Joi.object({
  user: Joi.objectId(),
  title: Joi.string().trim().lowercase(),
  description: Joi.string().trim().lowercase(),
  status: Joi.string()
    .trim()
    .valid(...Object.values(STATUSES.WORKSPACE))
    .default(STATUSES.WORKSPACE.ACTIVE),
  agents: Joi.array()
    .items(
      Joi.object({
        user: Joi.objectId(),
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
