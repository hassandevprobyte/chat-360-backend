'use strict';

const { serializeUserSummary } = require('../users/serializer');

function serializeWorkspace(workspace, member) {
  if (!workspace) return null;
  return {
    id: String(workspace._id || workspace.id),
    name: workspace.name,
    slug: workspace.slug,
    ownerId: String(workspace.owner),
    settings: workspace.settings || {},
    isActive: workspace.isActive !== false,
    suspendedAt: workspace.suspendedAt || null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    // Present only when the caller's own membership is known.
    ...(member ? { myRole: member.role, myPermissions: member.permissions || [] } : {}),
  };
}

function serializeMember(member, user) {
  if (!member) return null;
  return {
    id: String(member._id || member.id),
    workspaceId: String(member.workspace),
    role: member.role,
    permissions: member.permissions || [],
    isActive: member.isActive !== false,
    joinedAt: member.joinedAt || member.createdAt,
    createdAt: member.createdAt,
    user: user ? { ...serializeUserSummary(user), email: user.email } : { id: String(member.user) },
  };
}

function serializeInvitation(invitation) {
  if (!invitation) return null;
  return {
    id: String(invitation._id || invitation.id),
    workspaceId: String(invitation.workspace),
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    acceptedAt: invitation.acceptedAt || null,
  };
}

module.exports = { serializeWorkspace, serializeMember, serializeInvitation };
