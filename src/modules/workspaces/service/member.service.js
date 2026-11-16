'use strict';

const env = require('../../../config/env');
const {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} = require('../../../common/errors');
const {
  WORKSPACE_ROLES,
  AUDIT_ACTIONS,
  NOTIFICATION_TYPES,
  INVITATION_STATUS,
  ERROR_CODES,
} = require('../../../common/constants');
const { randomToken, sha256 } = require('../../../common/utils/crypto');
const { fromNow } = require('../../../common/utils/duration');
const { parsePage, pageMeta } = require('../../../common/utils/pagination');
const { requireObjectId, idEquals } = require('../../../common/utils/objectId');
const memberRepository = require('../repository/workspaceMember.repository');
const invitationRepository = require('../repository/invitation.repository');
const workspaceRepository = require('../repository/workspace.repository');
const userRepository = require('../../users/repository/user.repository');
const auditLogService = require('../../auditLogs/service/auditLog.service');
const notificationService = require('../../notifications/service/notification.service');
const emailService = require('../../../services/email/email.service');
const { serializeMember, serializeInvitation } = require('../serializer');

async function listMembers(workspaceId, query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspaceId };
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  const { items, total } = await memberRepository.paginate({ filter, skip, limit });
  const users = await userRepository.findByIds(items.map((m) => m.user));
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return {
    data: items.map((m) => serializeMember(m, byId.get(String(m.user)))),
    meta: pageMeta({ total, page, limit }),
  };
}

/**
 * Invites someone by email.
 *
 * If the address already belongs to a user they are still sent an invitation
 * rather than being added silently - joining a tenant is always opt-in.
 */
async function inviteMember(workspace, actor, { email, role }) {
  const normalizedEmail = String(email).toLowerCase();

  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    const existingMember = await memberRepository.findActiveMembership(workspace._id, existingUser._id);
    if (existingMember) {
      throw new ConflictError('This person is already a member of the workspace', ERROR_CODES.ALREADY_EXISTS);
    }
  }

  const pending = await invitationRepository.findPendingByEmail(workspace._id, normalizedEmail);
  if (pending) {
    throw new ConflictError('An invitation is already pending for this email', ERROR_CODES.ALREADY_EXISTS);
  }

  const rawToken = randomToken(32);
  const invitation = await invitationRepository.create({
    workspace: workspace._id,
    email: normalizedEmail,
    role,
    tokenHash: sha256(rawToken),
    invitedBy: actor._id,
    expiresAt: fromNow(env.tokens.invitationExpiresIn),
  });

  await emailService.sendWorkspaceInvitation({
    email: normalizedEmail,
    token: rawToken,
    workspace,
    inviter: actor,
    role,
  });

  if (existingUser) {
    await notificationService.notify({
      users: [existingUser._id],
      workspace: null,
      type: role === WORKSPACE_ROLES.AGENT
        ? NOTIFICATION_TYPES.AGENT_INVITATION
        : NOTIFICATION_TYPES.WORKSPACE_INVITATION,
      title: `You were invited to ${workspace.name}`,
      message: `${actor.name} invited you to join as ${role}.`,
      data: { workspaceId: String(workspace._id), invitationId: String(invitation._id) },
    });
  }

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.MEMBER_INVITED,
    resource: 'invitation',
    resourceId: invitation._id,
    metadata: { email: normalizedEmail, role },
  });

  return serializeInvitation(invitation);
}

async function listInvitations(workspaceId, query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspaceId };
  if (query.status) filter.status = query.status;
  const { items, total } = await invitationRepository.paginate({ filter, skip, limit });
  return { data: items.map(serializeInvitation), meta: pageMeta({ total, page, limit }) };
}

async function revokeInvitation(workspace, actor, invitationId) {
  const revoked = await invitationRepository.revoke(workspace._id, requireObjectId(invitationId, 'Invitation'));
  if (!revoked) throw new NotFoundError('Pending invitation not found');
  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.MEMBER_REMOVED,
    resource: 'invitation',
    resourceId: revoked._id,
    metadata: { email: revoked.email, revoked: true },
  });
  return serializeInvitation(revoked);
}

/**
 * Accepting an invitation is done by an authenticated user. The invitation
 * email must match the account email, so a leaked link cannot be redeemed by
 * somebody else's account.
 */
async function acceptInvitation(user, rawToken) {
  const invitation = await invitationRepository.findPendingByHash(sha256(rawToken));
  if (!invitation) throw new BadRequestError('This invitation is invalid or has expired', ERROR_CODES.TOKEN_INVALID);

  if (String(user.email).toLowerCase() !== invitation.email) {
    throw new ForbiddenError('This invitation was sent to a different email address');
  }

  const workspace = await workspaceRepository.findActiveById(invitation.workspace);
  if (!workspace) throw new NotFoundError('Workspace not found');

  const accepted = await invitationRepository.accept(invitation._id, user._id);
  if (!accepted) throw new ConflictError('This invitation has already been used');

  const member = await memberRepository.upsertMembership(workspace._id, user._id, {
    role: invitation.role,
    isActive: true,
    invitedBy: invitation.invitedBy,
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: user._id,
    action: AUDIT_ACTIONS.MEMBER_JOINED,
    resource: 'workspaceMember',
    resourceId: member._id,
    metadata: { role: invitation.role },
  });

  await notificationService.notify({
    users: [invitation.invitedBy],
    workspace: workspace._id,
    type: NOTIFICATION_TYPES.WORKSPACE_INVITATION,
    title: `${user.name} joined ${workspace.name}`,
    message: `They joined as ${invitation.role}.`,
    data: { workspaceId: String(workspace._id), userId: String(user._id) },
  });

  return {
    workspace: { id: String(workspace._id), name: workspace.name, slug: workspace.slug },
    member: serializeMember(member, user),
  };
}

/** Guards the "a workspace must always keep one active OWNER" invariant. */
async function assertNotLastOwner(workspaceId, member, { changingRole = false } = {}) {
  if (member.role !== WORKSPACE_ROLES.OWNER) return;
  const owners = await memberRepository.countOwners(workspaceId);
  if (owners <= 1) {
    throw new ConflictError(
      changingRole
        ? 'The last owner cannot be demoted. Transfer ownership first.'
        : 'The last owner cannot be removed. Transfer ownership first.',
    );
  }
}

async function updateMember(workspace, actor, memberId, payload) {
  const member = await memberRepository.findById(workspace._id, requireObjectId(memberId, 'Member'));
  if (!member) throw new NotFoundError('Member not found');

  if (idEquals(member.user, actor._id) && (payload.role || payload.isActive === false)) {
    throw new BadRequestError('You cannot change your own role or deactivate yourself');
  }

  const update = {};
  if (payload.role && payload.role !== member.role) {
    await assertNotLastOwner(workspace._id, member, { changingRole: true });
    update.role = payload.role;
  }
  if (payload.permissions) update.permissions = [...new Set(payload.permissions)];
  if (payload.isActive !== undefined) {
    if (payload.isActive === false) await assertNotLastOwner(workspace._id, member);
    update.isActive = payload.isActive;
  }
  if (!Object.keys(update).length) throw new BadRequestError('No changes supplied');

  const updated = await memberRepository.updateById(workspace._id, member._id, { $set: update });
  const user = await userRepository.findById(updated.user);

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: update.role ? AUDIT_ACTIONS.MEMBER_ROLE_CHANGED : AUDIT_ACTIONS.MEMBER_UPDATED,
    resource: 'workspaceMember',
    resourceId: updated._id,
    metadata: { targetUser: String(updated.user), changed: Object.keys(update), role: update.role },
  });

  return serializeMember(updated, user);
}

async function removeMember(workspace, actor, memberId) {
  const member = await memberRepository.findById(workspace._id, requireObjectId(memberId, 'Member'));
  if (!member) throw new NotFoundError('Member not found');
  if (idEquals(member.user, actor._id)) throw new BadRequestError('You cannot remove yourself from the workspace');

  await assertNotLastOwner(workspace._id, member);
  await memberRepository.removeById(workspace._id, member._id);

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.MEMBER_REMOVED,
    resource: 'workspaceMember',
    resourceId: member._id,
    metadata: { targetUser: String(member.user), role: member.role },
  });

  return { removed: true, memberId: String(member._id) };
}

module.exports = {
  INVITATION_STATUS,
  listMembers,
  inviteMember,
  listInvitations,
  revokeInvitation,
  acceptInvitation,
  updateMember,
  removeMember,
};
