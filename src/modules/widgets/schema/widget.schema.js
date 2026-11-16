'use strict';

const Joi = require('joi');
const { WIDGET_POSITIONS } = require('../../../common/constants');
const {
  name,
  objectId,
  hexColor,
  pageQuery,
  workspaceParams,
  workspaceScopedParams,
} = require('../../../common/validators/common.validators');

const businessHoursDay = Joi.object({
  enabled: Joi.boolean(),
  from: Joi.number().integer().min(0).max(1440),
  to: Joi.number().integer().min(0).max(1440),
});

const settings = Joi.object({
  primaryColor: hexColor,
  launcherColor: hexColor,
  textColor: hexColor,
  position: Joi.string().valid(...Object.values(WIDGET_POSITIONS)),
  offsetX: Joi.number().integer().min(0).max(200),
  offsetY: Joi.number().integer().min(0).max(200),
  logo: Joi.string().uri().max(512).allow(null, ''),
  avatar: Joi.string().uri().max(512).allow(null, ''),
  headerTitle: Joi.string().max(80),
  headerSubtitle: Joi.string().max(140).allow(''),
  welcomeMessage: Joi.string().max(500).allow(''),
  offlineMessage: Joi.string().max(500).allow(''),
  launcherText: Joi.string().max(60).allow(null, ''),
  soundNotification: Joi.boolean(),
  fileUploadEnabled: Joi.boolean(),
  showAgentAvailability: Joi.boolean(),
  preChatForm: Joi.object({
    enabled: Joi.boolean(),
    fields: Joi.array()
      .items(
        Joi.object({
          key: Joi.string().valid('name', 'email', 'phone', 'message').required(),
          label: Joi.string().max(80).required(),
          required: Joi.boolean().default(false),
        }),
      )
      .max(4),
  }),
  businessHours: Joi.object({
    enabled: Joi.boolean(),
    timezone: Joi.string().max(64),
    days: Joi.object({
      mon: businessHoursDay,
      tue: businessHoursDay,
      wed: businessHoursDay,
      thu: businessHoursDay,
      fri: businessHoursDay,
      sat: businessHoursDay,
      sun: businessHoursDay,
    }),
  }),
  branding: Joi.object({
    showBranding: Joi.boolean(),
    brandingText: Joi.string().max(60).allow(null, ''),
    brandingUrl: Joi.string().uri().max(512).allow(null, ''),
  }),
});

const createWidget = {
  params: workspaceParams,
  body: Joi.object({
    websiteId: objectId.required(),
    name: name.required(),
    settings,
  }),
};

const listWidgets = {
  params: workspaceParams,
  query: pageQuery.keys({ websiteId: objectId, isActive: Joi.boolean() }),
};

const widgetParams = { params: workspaceScopedParams('widgetId') };

const updateWidget = {
  params: workspaceScopedParams('widgetId'),
  // publicKey, workspace and website are never client-writable.
  body: Joi.object({ name, isActive: Joi.boolean(), settings }).min(1),
};

module.exports = { createWidget, listWidgets, widgetParams, updateWidget, settingsSchema: settings };
