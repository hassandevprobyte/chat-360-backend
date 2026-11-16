'use strict';

const {
  WORKSPACE_ROLES,
  PERMISSIONS,
  AGENT_DEFAULT_PERMISSIONS,
} = require('../../../common/constants');

const ALL_PERMISSIONS = Object.values(PERMISSIONS);

/**
 * Resolves the effective permission set for a membership.
 *
 * OWNER implicitly holds every permission. AGENT holds the v1 agent defaults
 * plus any additive grants stored on the membership record. There are no custom
 * roles in v1 - `permissions` is only an extensibility seam.
 */
function effectivePermissions(member) {
  if (!member || member.isActive === false) return [];
  if (member.role === WORKSPACE_ROLES.OWNER) return [...ALL_PERMISSIONS];
  return [...new Set([...AGENT_DEFAULT_PERMISSIONS, ...(member.permissions || [])])];
}

const hasPermission = (member, permission) => effectivePermissions(member).includes(permission);

const hasRole = (member, roles) =>
  Boolean(member) && member.isActive !== false && [].concat(roles).includes(member.role);

const isOwner = (member) => hasRole(member, WORKSPACE_ROLES.OWNER);

/** OWNER and AGENT are both eligible to handle conversations. */
const canHandleConversations = (member) =>
  hasRole(member, [WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.AGENT]);

/**
 * Conversation-level visibility. v1 keeps this simple and permissive inside a
 * workspace: anyone eligible sees the queue and any conversation in the tenant.
 * The hook exists so stricter rules (teams, ownership-only) can land later.
 */
function canAccessConversation(member, conversation) {
  if (!canHandleConversations(member)) return false;
  if (isOwner(member)) return true;
  return hasPermission(member, PERMISSIONS.CONVERSATION_VIEW);
}

function canCloseConversation(member, conversation, workspaceSettings = {}) {
  if (isOwner(member)) return true;
  if (!hasPermission(member, PERMISSIONS.CONVERSATION_CLOSE)) return false;
  const assignedToSomeoneElse =
    conversation.assignedTo && String(conversation.assignedTo) !== String(member.user);
  if (assignedToSomeoneElse) return Boolean(workspaceSettings.allowAgentCloseUnassigned);
  if (!conversation.assignedTo) return Boolean(workspaceSettings.allowAgentCloseUnassigned);
  return true;
}

module.exports = {
  ALL_PERMISSIONS,
  effectivePermissions,
  hasPermission,
  hasRole,
  isOwner,
  canHandleConversations,
  canAccessConversation,
  canCloseConversation,
};
