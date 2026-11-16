'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok } = require('../../../common/response');
const service = require('../service/superAdmin.service');

const paged = (fn) =>
  asyncHandler(async (req, res) => {
    const { data, meta } = await fn(req);
    return ok(res, data, meta);
  });

const listUsers = paged((req) => service.listUsers(req.query));
const getUser = asyncHandler(async (req, res) => ok(res, await service.getUser(req.params.userId)));
const setUserActive = asyncHandler(async (req, res) =>
  ok(res, await service.setUserActive(req.user, req.params.userId, req.body.isActive)));

const listWorkspaces = paged((req) => service.listWorkspaces(req.query));
const getWorkspace = asyncHandler(async (req, res) => ok(res, await service.getWorkspace(req.user, req.params.workspaceId)));
const listMembers = paged((req) => service.listWorkspaceMembers(req.params.workspaceId, req.query));
const suspend = asyncHandler(async (req, res) =>
  ok(res, await service.setWorkspaceActive(req.user, req.params.workspaceId, false, req.body.reason)));
const reactivate = asyncHandler(async (req, res) =>
  ok(res, await service.setWorkspaceActive(req.user, req.params.workspaceId, true, req.body.reason)));

const listConversations = paged((req) =>
  service.listWorkspaceConversations(req.user, req.params.workspaceId, req.query));
const inspectConversation = asyncHandler(async (req, res) => {
  const { conversation, messages, meta } = await service.inspectConversation(
    req.user,
    req.params.workspaceId,
    req.params.conversationId,
    req.query,
  );
  return ok(res, { conversation, messages }, meta);
});

module.exports = {
  listUsers,
  getUser,
  setUserActive,
  listWorkspaces,
  getWorkspace,
  listMembers,
  suspend,
  reactivate,
  listConversations,
  inspectConversation,
};
