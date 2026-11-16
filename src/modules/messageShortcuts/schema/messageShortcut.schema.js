'use strict';

const Joi = require('joi');
const {
  pageQuery,
  workspaceParams,
  workspaceScopedParams,
} = require('../../../common/validators/common.validators');

// A leading slash is accepted and stripped by the service.
const trigger = Joi.string().trim().min(1).max(41);

const createShortcut = {
  params: workspaceParams,
  body: Joi.object({
    shortcut: trigger.required(),
    content: Joi.string().trim().min(1).max(4000).required(),
    isActive: Joi.boolean().default(true),
  }),
};

const listShortcuts = {
  params: workspaceParams,
  query: pageQuery.keys({
    isActive: Joi.boolean(),
    // `all=true` returns the full (bounded) list for client-side "/" filtering.
    all: Joi.boolean().default(false),
  }),
};

const shortcutParams = { params: workspaceScopedParams('shortcutId') };

const updateShortcut = {
  params: workspaceScopedParams('shortcutId'),
  body: Joi.object({
    shortcut: trigger,
    content: Joi.string().trim().min(1).max(4000),
    isActive: Joi.boolean(),
  }).min(1),
};

module.exports = { createShortcut, listShortcuts, shortcutParams, updateShortcut };
