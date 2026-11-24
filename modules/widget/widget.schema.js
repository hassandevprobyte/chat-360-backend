const Joi = require("../../config/joi");

// Constants
const { LOCALES, TIMEZONE, WIDGET } = require("../../common/constants");

const { PRE_CHAT_FIELDS, WIDGET_POSITIONS } = WIDGET;

const preChatFieldSchema = Joi.object({
  key: Joi.string()
    .valid(...Object.values(PRE_CHAT_FIELDS))
    .required(),
  label: Joi.string().max(80).required(),
  required: Joi.boolean().default(false),
});

const businessHoursDaySchema = Joi.object({
  enabled: Joi.boolean().default(true),
  from: Joi.number().integer().min(0).max(1440).default(540),
  to: Joi.number().integer().min(0).max(1440).default(1020),
});

const businessHoursDaysSchema = Joi.object({
  mon: businessHoursDaySchema.default({}),
  tue: businessHoursDaySchema.default({}),
  wed: businessHoursDaySchema.default({}),
  thu: businessHoursDaySchema.default({}),
  fri: businessHoursDaySchema.default({}),
  sat: businessHoursDaySchema.default({ enabled: false }),
  sun: businessHoursDaySchema.default({ enabled: false }),
});

exports.getWidgetById = Joi.object({
  workspace: Joi.objectId().required(),
  id: Joi.objectId().required(),
});

exports.baseSchema = Joi.object({
  workspace: Joi.objectId(),
  website: Joi.objectId(),
  title: Joi.string().trim().max(120),
  publicKey: Joi.string(),
  secretKey: Joi.string(),
  isActive: Joi.boolean().default(true),
  settings: Joi.object({
    style: Joi.object({
      primaryColor: Joi.string().max(32).default("#2563eb"),
      launcherColor: Joi.string().max(32).default("#2563eb"),
      textColor: Joi.string().max(32).default("#ffffff"),
      position: Joi.string()
        .valid(...Object.values(WIDGET_POSITIONS))
        .default(WIDGET_POSITIONS.BOTTOM_RIGHT),
      offsetX: Joi.number().min(0).max(200).default(20),
      offsetY: Joi.number().min(0).max(200).default(20),
    }),
    message: Joi.object({
      welcome: Joi.string().trim().lowercase().default("Hi there! How can we help?"),
      offline: Joi.string().trim().lowercase().default("We are offline right now. Leave a message and we will get back to you."),
    }),
    header: Joi.object({
      logo: Joi.string().allow(null).default(null),
      avatar: Joi.string().allow(null).default(null),
      title: Joi.string().default("Chat with us"),
      subtitle: Joi.string().default("We usually reply in a few minutes"),
    }),
    launcher: Joi.object({
      textEnabled: Joi.boolean().default(true),
      text: Joi.string().max(60).when("textEnabled", {
        is: true,
        then: Joi.string().required(),
      }),
      icon: Joi.string().required(),
    }),
    preChatForm: Joi.object({
      enabled: Joi.boolean().default(false),

      fields: Joi.array()
        .items(preChatFieldSchema)
        .default([])
        .when("enabled", {
          is: true,
          then: Joi.array().min(1).required(),
        }),
    }),
    businessHours: Joi.object({
      enabled: Joi.boolean().default(false),
      timezone: Joi.string()
        .valid(...Object.values(TIMEZONE))
        .default(TIMEZONE.UTC),
      days: businessHoursDaysSchema.default({}),
    }),
    branding: Joi.object({
      showBranding: Joi.boolean().default(true),
      logo: Joi.string().allow(null).default(null),
      text: Joi.string().default("Powered by Chat360"),
      url: Joi.string().allow(null).default(null),
    }),
    locale: Joi.string()
      .valid(...Object.values(LOCALES))
      .default(LOCALES.EN_US),
    soundNotification: Joi.boolean().default(true),
    showTypingIndicator: Joi.boolean().default(true),
    showAgentAvailability: Joi.boolean().default(false),
    fileUploadEnabled: Joi.boolean().default(false),
    showQuickReplies: Joi.boolean().default(false),
  }),
  deletedAt: Joi.date().allow(null),
});

exports.createWidget = exports.baseSchema
  .fork(["workspace", "website", "title"], (schema) => schema.required())
  .fork(["publicKey", "secretKey", "deletedAt"], (schema) => schema.strip());

exports.updateWidget = exports.baseSchema
  .append({
    id: Joi.objectId().required(),
  })
  .fork(["website", "publicKey", "secretKey", "deletedAt"], (schema) => schema.strip());
