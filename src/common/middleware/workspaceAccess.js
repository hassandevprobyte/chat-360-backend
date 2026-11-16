'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ForbiddenError, UnauthorizedError } = require('../errors');
const { ERROR_CODES } = require('../constants');
const { requireObjectId } = require('../utils/objectId');
const workspaceRepository = require('../../modules/workspaces/repository/workspace.repository');
const memberRepository = require('../../modules/workspaces/repository/workspaceMember.repository');
const authorizationService = require('../../modules/workspaces/service/authorization.service');

/**
 * Loads the workspace named in the route.
 *
 * The client-supplied workspaceId is only ever used as a lookup key; access is
 * decided by resolveWorkspaceMember below. A suspended workspace is readable by
 * nobody but a Super Admin (who uses the /super-admin routes instead).
 */
const resolveWorkspace = asyncHandler(async (req, res, next) => {
  const workspaceId = requireObjectId(req.params.workspaceId, 'Workspace');
  const workspace = await workspaceRepository.findById(workspaceId);

  if (!workspace) throw new NotFoundError('Workspace not found');
  if (!workspace.isActive) {
    throw new ForbiddenError('This workspace is suspended', ERROR_CODES.WORKSPACE_SUSPENDED);
  }

  req.workspace = workspace;
  req.workspaceId = workspace._id;
  return next();
});

/**
 * Turns the authenticated user + workspace into a WorkspaceMember record.
 * Everything downstream authorizes against req.member, never against anything
 * the client sent.
 */
const resolveWorkspaceMember = asyncHandler(async (req, res, next) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  if (!req.workspace) throw new NotFoundError('Workspace not found');

  const member = await memberRepository.findActiveMembership(req.workspace._id, req.user._id);
  if (!member) {
    // 404-flavoured wording would be friendlier to enumeration; 403 with a
    // specific code is clearer for the dashboard and the id was already known.
    throw new ForbiddenError('You are not a member of this workspace', ERROR_CODES.NOT_WORKSPACE_MEMBER);
  }

  req.member = member;
  req.permissions = authorizationService.effectivePermissions(member);
  return next();
});

/** Convenience: workspace + membership in one step. */
const requireWorkspaceMember = [resolveWorkspace, resolveWorkspaceMember];

const requireWorkspaceRole = (...roles) => (req, res, next) => {
  const allowed = roles.flat();
  if (!authorizationService.hasRole(req.member, allowed)) {
    return next(
      new ForbiddenError(
        `This action requires one of the following workspace roles: ${allowed.join(', ')}`,
        ERROR_CODES.INSUFFICIENT_ROLE,
      ),
    );
  }
  return next();
};

const requireWorkspacePermission = (...permissions) => (req, res, next) => {
  const required = permissions.flat();
  const granted = req.permissions || [];
  const missing = required.filter((p) => !granted.includes(p));
  if (missing.length) {
    return next(
      new ForbiddenError('You do not have permission to perform this action', ERROR_CODES.INSUFFICIENT_PERMISSION, {
        missing,
      }),
    );
  }
  return next();
};

module.exports = {
  resolveWorkspace,
  resolveWorkspaceMember,
  requireWorkspaceMember,
  requireWorkspaceRole,
  requireWorkspacePermission,
};
