'use strict';

const Joi = require('joi');
const { PLATFORM_ROLES, CONVERSATION_STATUS } = require('../../../common/constants');
const {
  objectId,
  pageQuery,
  cursorQuery,
  idParam,
  workspaceParams,
  workspaceScopedParams,
} = require('../../../common/validators/common.validators');

const listUsers = {
  query: pageQuery.keys({
    platformRole: Joi.string().valid(...Object.values(PLATFORM_ROLES)),
    isActive: Joi.boolean(),
  }),
};
const userParams = { params: idParam('userId') };
const setUserActive = { params: idParam('userId'), body: Joi.object({ isActive: Joi.boolean().required() }) };

const listWorkspaces = { query: pageQuery.keys({ isActive: Joi.boolean() }) };
const workspaceOnly = { params: workspaceParams };
const listMembers = { params: workspaceParams, query: pageQuery };
const suspendWorkspace = {
  params: workspaceParams,
  body: Joi.object({ reason: Joi.string().trim().max(200).allow('', null) }).default({}),
};
const listConversations = {
  params: workspaceParams,
  query: pageQuery.keys({ status: Joi.string().valid(...Object.values(CONVERSATION_STATUS)) }),
};
const inspectConversation = { params: workspaceScopedParams('conversationId'), query: cursorQuery };

module.exports = {
  objectId,
  listUsers,
  userParams,
  setUserActive,
  listWorkspaces,
  workspaceOnly,
  listMembers,
  suspendWorkspace,
  listConversations,
  inspectConversation,
};
