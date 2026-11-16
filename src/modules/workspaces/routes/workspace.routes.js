'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const {
  requireWorkspaceMember,
  requireWorkspaceRole,
} = require('../../../common/middleware/workspaceAccess');
const { WORKSPACE_ROLES } = require('../../../common/constants');
const schema = require('../schema/workspace.schema');
const controller = require('../controller/workspace.controller');

const router = express.Router();

/**
 * Mounted at /api/v1/workspaces behind `authenticate` (see routes.js).
 *
 * Every workspace-scoped route runs `requireWorkspaceMember`, which resolves the
 * workspace and the caller's WorkspaceMember record before any controller runs.
 * Controllers never re-check membership.
 */

router.get('/', controller.listMine);
router.post('/', validate(schema.createWorkspace), controller.create);

router.get('/:workspaceId', validate(schema.getWorkspace), requireWorkspaceMember, controller.get);

router.patch(
  '/:workspaceId',
  validate(schema.updateWorkspace),
  requireWorkspaceMember,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER),
  controller.update,
);

router.post(
  '/:workspaceId/transfer-ownership',
  validate(schema.transferOwnership),
  requireWorkspaceMember,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER),
  controller.transferOwnership,
);

router.get('/:workspaceId/presence', validate(schema.getWorkspace), requireWorkspaceMember, controller.getPresence);

/* ---------------------------------- members --------------------------------- */

router.get('/:workspaceId/members', validate(schema.listMembers), requireWorkspaceMember, controller.listMembers);

router.post(
  '/:workspaceId/members/invite',
  validate(schema.inviteMember),
  requireWorkspaceMember,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER),
  controller.invite,
);

router.get(
  '/:workspaceId/invitations',
  validate(schema.listInvitations),
  requireWorkspaceMember,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER),
  controller.listInvitations,
);

router.delete(
  '/:workspaceId/invitations/:invitationId',
  validate(schema.revokeInvitation),
  requireWorkspaceMember,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER),
  controller.revokeInvitation,
);

router.patch(
  '/:workspaceId/members/:memberId',
  validate(schema.updateMember),
  requireWorkspaceMember,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER),
  controller.updateMember,
);

router.delete(
  '/:workspaceId/members/:memberId',
  validate(schema.removeMember),
  requireWorkspaceMember,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER),
  controller.removeMember,
);

module.exports = router;
