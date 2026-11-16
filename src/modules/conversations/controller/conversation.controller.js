'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok, created } = require('../../../common/response');
const conversationService = require('../service/conversation.service');
const assignmentService = require('../service/assignment.service');
const messageService = require('../../messages/service/message.service');

/** Controllers stay thin: they only assemble the server-verified context. */
const ctx = (req) => ({ workspace: req.workspace, actor: req.user, member: req.member });

const list = asyncHandler(async (req, res) => {
  const { data, meta } = await conversationService.listConversations(req.workspaceId, req.member, req.query);
  return ok(res, data, meta);
});

const listUnassigned = asyncHandler(async (req, res) => {
  const { data, meta } = await conversationService.listUnassigned(req.workspaceId, req.member, req.query);
  return ok(res, data, meta);
});

const counts = asyncHandler(async (req, res) =>
  ok(res, await conversationService.getInboxCounts(req.workspaceId, req.member)));

const get = asyncHandler(async (req, res) =>
  ok(res, await conversationService.getConversation(req.workspaceId, req.member, req.params.conversationId)));

const update = asyncHandler(async (req, res) =>
  ok(res, await conversationService.updateConversation(ctx(req), req.params.conversationId, req.body)));

const claim = asyncHandler(async (req, res) => {
  const result = await assignmentService.claim(ctx(req), req.params.conversationId);
  return ok(res, result.conversation, { claimed: result.claimed });
});

const assign = asyncHandler(async (req, res) => {
  const result = await assignmentService.assignToUser(ctx(req), req.params.conversationId, req.body.userId);
  return ok(res, result.conversation);
});

const unassign = asyncHandler(async (req, res) => {
  const result = await assignmentService.unassign(ctx(req), req.params.conversationId);
  return ok(res, result.conversation);
});

const close = asyncHandler(async (req, res) => {
  const result = await conversationService.closeConversation(ctx(req), req.params.conversationId, req.body);
  return ok(res, result.conversation, { changed: result.changed });
});

const reopen = asyncHandler(async (req, res) => {
  const result = await conversationService.reopenConversation(ctx(req), req.params.conversationId);
  return ok(res, result.conversation, { changed: result.changed });
});

const setTags = asyncHandler(async (req, res) =>
  ok(res, await conversationService.setTags(ctx(req), req.params.conversationId, req.body.tagIds)));

const addTag = asyncHandler(async (req, res) =>
  ok(res, await conversationService.addTag(ctx(req), req.params.conversationId, req.params.tagId)));

const removeTag = asyncHandler(async (req, res) =>
  ok(res, await conversationService.removeTag(ctx(req), req.params.conversationId, req.params.tagId)));

const markRead = asyncHandler(async (req, res) =>
  ok(res, await conversationService.markReadByAgent(ctx(req), req.params.conversationId)));

/* ------------------------------- messages -------------------------------- */

const listMessages = asyncHandler(async (req, res) => {
  const { data, meta } = await messageService.listMessages(
    req.workspaceId,
    req.member,
    req.params.conversationId,
    req.query,
  );
  return ok(res, data, meta);
});

const sendMessage = asyncHandler(async (req, res) => {
  const result = await messageService.createAgentMessage(ctx(req), req.params.conversationId, req.body);
  return created(res, result.message, { claimed: result.claimed, attachments: result.attachments });
});

const editMessage = asyncHandler(async (req, res) =>
  ok(res, await messageService.editMessage(ctx(req), req.params.conversationId, req.params.messageId, req.body)));

module.exports = {
  list,
  listUnassigned,
  counts,
  get,
  update,
  claim,
  assign,
  unassign,
  close,
  reopen,
  setTags,
  addTag,
  removeTag,
  markRead,
  listMessages,
  sendMessage,
  editMessage,
};
