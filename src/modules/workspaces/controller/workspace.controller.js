'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok, created } = require('../../../common/response');
const workspaceService = require('../service/workspace.service');
const memberService = require('../service/member.service');

const create = asyncHandler(async (req, res) =>
  created(res, await workspaceService.createWorkspace(req.user, req.body)));

const listMine = asyncHandler(async (req, res) =>
  ok(res, await workspaceService.listMyWorkspaces(req.user._id)));

const get = asyncHandler(async (req, res) =>
  ok(res, await workspaceService.getWorkspace(req.workspace, req.member)));

const update = asyncHandler(async (req, res) =>
  ok(res, await workspaceService.updateWorkspace(req.workspace, req.user, req.body)));

const transferOwnership = asyncHandler(async (req, res) =>
  ok(res, await workspaceService.transferOwnership(req.workspace, req.user, req.body.memberId)));

const getPresence = asyncHandler(async (req, res) =>
  ok(res, await workspaceService.getPresence(req.workspaceId)));

/* members */

const listMembers = asyncHandler(async (req, res) => {
  const { data, meta } = await memberService.listMembers(req.workspaceId, req.query);
  return ok(res, data, meta);
});

const invite = asyncHandler(async (req, res) =>
  created(res, await memberService.inviteMember(req.workspace, req.user, req.body)));

const listInvitations = asyncHandler(async (req, res) => {
  const { data, meta } = await memberService.listInvitations(req.workspaceId, req.query);
  return ok(res, data, meta);
});

const revokeInvitation = asyncHandler(async (req, res) =>
  ok(res, await memberService.revokeInvitation(req.workspace, req.user, req.params.invitationId)));

const updateMember = asyncHandler(async (req, res) =>
  ok(res, await memberService.updateMember(req.workspace, req.user, req.params.memberId, req.body)));

const removeMember = asyncHandler(async (req, res) =>
  ok(res, await memberService.removeMember(req.workspace, req.user, req.params.memberId)));

const acceptInvitation = asyncHandler(async (req, res) =>
  ok(res, await memberService.acceptInvitation(req.user, req.body.token)));

module.exports = {
  create,
  listMine,
  get,
  update,
  transferOwnership,
  getPresence,
  listMembers,
  invite,
  listInvitations,
  revokeInvitation,
  updateMember,
  removeMember,
  acceptInvitation,
};
