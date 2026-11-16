'use strict';

const Joi = require('joi');
const { WORKSPACE_ROLES, PERMISSIONS, INVITATION_STATUS } = require('../../../common/constants');
const {
  name,
  email,
  objectId,
  pageQuery,
  workspaceParams,
  workspaceScopedParams,
} = require('../../../common/validators/common.validators');

const settings = Joi.object({
  timezone: Joi.string().max(64),
  locale: Joi.string().max(16),
  allowAgentCloseUnassigned: Joi.boolean(),
  emailOnNewConversation: Joi.boolean(),
  emailOnNewMessage: Joi.boolean(),
  conversationAutoCloseHours: Joi.number().integer().min(0).max(720),
});

const createWorkspace = { body: Joi.object({ name: name.required() }) };

const getWorkspace = { params: workspaceParams };

const updateWorkspace = {
  params: workspaceParams,
  // `owner`, `slug`, `isActive` and `suspendedAt` are intentionally not writable.
  body: Joi.object({ name, settings }).min(1),
};

const transferOwnership = {
  params: workspaceParams,
  body: Joi.object({ memberId: objectId.required() }),
};

const listMembers = {
  params: workspaceParams,
  query: pageQuery.keys({
    role: Joi.string().valid(...Object.values(WORKSPACE_ROLES)),
    isActive: Joi.boolean(),
  }),
};

const inviteMember = {
  params: workspaceParams,
  body: Joi.object({
    email: email.required(),
    role: Joi.string().valid(...Object.values(WORKSPACE_ROLES)).default(WORKSPACE_ROLES.AGENT),
  }),
};

const listInvitations = {
  params: workspaceParams,
  query: pageQuery.keys({ status: Joi.string().valid(...Object.values(INVITATION_STATUS)) }),
};

const revokeInvitation = { params: workspaceScopedParams('invitationId') };

const updateMember = {
  params: workspaceScopedParams('memberId'),
  body: Joi.object({
    role: Joi.string().valid(...Object.values(WORKSPACE_ROLES)),
    permissions: Joi.array().items(Joi.string().valid(...Object.values(PERMISSIONS))).max(20),
    isActive: Joi.boolean(),
  }).min(1),
};

const removeMember = { params: workspaceScopedParams('memberId') };

const acceptInvitation = { body: Joi.object({ token: Joi.string().max(512).required() }) };

module.exports = {
  createWorkspace,
  getWorkspace,
  updateWorkspace,
  transferOwnership,
  listMembers,
  inviteMember,
  listInvitations,
  revokeInvitation,
  updateMember,
  removeMember,
  acceptInvitation,
};
