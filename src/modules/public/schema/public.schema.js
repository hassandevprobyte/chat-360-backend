'use strict';

const Joi = require('joi');
const { objectId, cursorQuery, metadata } = require('../../../common/validators/common.validators');

const publicKey = Joi.string().trim().pattern(/^wk_[A-Za-z0-9_-]{16,64}$/).required();
const publicKeyParams = Joi.object({ publicKey });
const conversationParams = Joi.object({ conversationId: objectId.required() });

const widgetConfig = { params: publicKeyParams };

const initVisitor = {
  params: publicKeyParams,
  body: Joi.object({
    anonymousId: Joi.string().trim().pattern(/^v_[A-Za-z0-9_-]{8,64}$/),
    page: Joi.string().uri({ allowRelative: false }).max(512),
    referrer: Joi.string().max(512).allow(''),
    language: Joi.string().trim().max(16),
  }).default({}),
};

const visitorIdentity = Joi.object({
  name: Joi.string().trim().max(120).allow(''),
  email: Joi.string().email({ tlds: { allow: false } }).max(254).allow(''),
  phone: Joi.string().trim().max(40).allow(''),
  metadata,
}).min(1);

const identify = { body: visitorIdentity };

const activity = { body: Joi.object({ page: Joi.string().uri().max(512) }).default({}) };

const listConversations = { query: cursorQuery };

const startConversation = {
  body: Joi.object({
    content: Joi.string().trim().max(10000).allow('').default(''),
    attachmentIds: Joi.array().items(objectId).max(5).default([]),
    subject: Joi.string().trim().max(160),
    page: Joi.string().uri().max(512),
    // Pre-chat form values.
    visitor: visitorIdentity,
  }).or('content', 'attachmentIds'),
};

const conversationOnly = { params: conversationParams };

const listMessages = { params: conversationParams, query: cursorQuery };

/** No `type` field: the server derives it, so a visitor cannot mint an INTERNAL_NOTE. */
const sendMessage = {
  params: conversationParams,
  body: Joi.object({
    content: Joi.string().trim().max(10000).allow('').default(''),
    attachmentIds: Joi.array().items(objectId).max(5).default([]),
  }).or('content', 'attachmentIds'),
};

const uploadAttachment = { body: Joi.object({ conversationId: objectId }) };

const attachmentParams = { params: Joi.object({ attachmentId: objectId.required() }) };

module.exports = {
  widgetConfig,
  initVisitor,
  identify,
  activity,
  listConversations,
  startConversation,
  conversationOnly,
  listMessages,
  sendMessage,
  uploadAttachment,
  attachmentParams,
};
