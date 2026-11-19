const Joi = require("../../config/joi");

// Constants
const { WIDGET_POSITIONS } = require("../../common/constants");

exports.getWidgetById = Joi.objectId().required();

exports.baseSchema = Joi.object({
  workspace: Joi.objectId(),
  website: Joi.objectId(),
  title: Joi.string().trim().max(120),
  publicKey: Joi.string(),
  isActive: Joi.boolean().default(true),
  settings: Joi.object({
    primaryColor: Joi.string().max(32),
    launcherColor: Joi.string().max(32),
    textColor: Joi.string().max(32),
    position: Joi.string().valid(...Object.values(WIDGET_POSITIONS)),
    offsetX: Joi.number().min(0).max(200),
    offsetY: Joi.number().min(0).max(200),
    logo: Joi.string().max(512).allow(null),
    avatar: Joi.string().max(512).allow(null),
    headerTitle: Joi.string().max(80),
    headerSubtitle: Joi.string().max(140),
    welcomeMessage: Joi.string().max(500),
    offlineMessage: Joi.string().max(500),
    launcherText: Joi.string().max(60).allow(null),
    soundNotification: Joi.boolean(),
    fileUploadEnabled: Joi.boolean(),
    showAgentAvailability: Joi.boolean(),
    preChatForm: Joi.object({
      enabled: Joi.boolean(),
      fields: Joi.array().items(
        Joi.object({
          key: Joi.string().valid("title", "email", "phone", "message").required(),
          label: Joi.string().max(80).required(),
          required: Joi.boolean().default(false),
        }),
      ),
    }),
    businessHours: Joi.object({
      enabled: Joi.boolean(),
      timezone: Joi.string().max(64),
      days: Joi.object({
        mon: Joi.object({
          enabled: Joi.boolean(),
          from: Joi.number().integer().min(0).max(1440),
          to: Joi.number().integer().min(0).max(1440),
        }),
        tue: Joi.object({
          enabled: Joi.boolean(),
          from: Joi.number().integer().min(0).max(1440),
          to: Joi.number().integer().min(0).max(1440),
        }),
        wed: Joi.object({
          enabled: Joi.boolean(),
          from: Joi.number().integer().min(0).max(1440),
          to: Joi.number().integer().min(0).max(1440),
        }),
        thu: Joi.object({
          enabled: Joi.boolean(),
          from: Joi.number().integer().min(0).max(1440),
          to: Joi.number().integer().min(0).max(1440),
        }),
        fri: Joi.object({
          enabled: Joi.boolean(),
          from: Joi.number().integer().min(0).max(1440),
          to: Joi.number().integer().min(0).max(1440),
        }),
        sat: Joi.object({
          enabled: Joi.boolean(),
          from: Joi.number().integer().min(0).max(1440),
          to: Joi.number().integer().min(0).max(1440),
        }),
        sun: Joi.object({
          enabled: Joi.boolean(),
          from: Joi.number().integer().min(0).max(1440),
          to: Joi.number().integer().min(0).max(1440),
        }),
      }),
    }),
    branding: Joi.object({
      showBranding: Joi.boolean(),
      brandingText: Joi.string().max(60),
      brandingUrl: Joi.string().max(512).allow(null),
    }),
  }),
  deletedAt: Joi.date().allow(null),
});

exports.createWidget = exports.baseSchema
  .fork(["workspace", "website", "title"], (schema) => schema.required())
  .fork(["publicKey", "deletedAt"], (schema) => schema.strip())
  .fork("isActive", (schema) => schema.default(true));

exports.updateWidget = exports.baseSchema.append({ id: Joi.objectId().required() }).fork(["workspace", "website", "publicKey", "deletedAt"], (schema) => schema.strip());
