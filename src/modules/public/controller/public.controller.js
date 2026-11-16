'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok, created } = require('../../../common/response');
const publicService = require('../service/public.service');

/** Visitor context assembled by visitorAuth - never from the request body. */
const ctx = (req) => ({
  workspace: req.workspace,
  website: req.website,
  widget: req.widget,
  visitor: req.visitor,
});

const getConfig = asyncHandler(async (req, res) =>
  ok(res, await publicService.getWidgetConfig(req.params.publicKey, req)));

const init = asyncHandler(async (req, res) =>
  ok(res, await publicService.initVisitor(req.params.publicKey, req.body, req)));

const identify = asyncHandler(async (req, res) => ok(res, await publicService.identify(ctx(req), req.body)));
const activity = asyncHandler(async (req, res) => ok(res, await publicService.activity(ctx(req), req.body)));
const leave = asyncHandler(async (req, res) => ok(res, await publicService.leave(ctx(req))));

const listConversations = asyncHandler(async (req, res) => {
  const { data, meta } = await publicService.listConversations(ctx(req), req.query);
  return ok(res, data, meta);
});

const startConversation = asyncHandler(async (req, res) =>
  created(res, await publicService.startConversation(ctx(req), req.body, req)));

const getConversation = asyncHandler(async (req, res) =>
  ok(res, await publicService.getConversation(ctx(req), req.params.conversationId)));

const listMessages = asyncHandler(async (req, res) => {
  const { data, meta } = await publicService.listMessages(ctx(req), req.params.conversationId, req.query);
  return ok(res, data, meta);
});

const sendMessage = asyncHandler(async (req, res) =>
  created(res, await publicService.sendMessage(ctx(req), req.params.conversationId, req.body)));

const markRead = asyncHandler(async (req, res) =>
  ok(res, await publicService.markRead(ctx(req), req.params.conversationId)));

const closeConversation = asyncHandler(async (req, res) =>
  ok(res, await publicService.closeConversation(ctx(req), req.params.conversationId)));

const uploadAttachment = asyncHandler(async (req, res) =>
  created(res, await publicService.uploadAttachment(ctx(req), req.file, req.body.conversationId)));

const downloadAttachment = asyncHandler(async (req, res) => {
  const result = await publicService.downloadAttachment(ctx(req), req.params.attachmentId);
  if (result.redirectTo) return res.redirect(302, result.redirectTo);
  res.set(result.headers);
  return result.stream.pipe(res);
});

module.exports = {
  getConfig,
  init,
  identify,
  activity,
  leave,
  listConversations,
  startConversation,
  getConversation,
  listMessages,
  sendMessage,
  markRead,
  closeConversation,
  uploadAttachment,
  downloadAttachment,
};
