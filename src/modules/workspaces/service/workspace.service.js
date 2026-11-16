'use strict';

const { withTransaction } = require('../../../config/database');
const { NotFoundError, ForbiddenError } = require('../../../common/errors');
const { WORKSPACE_ROLES, AUDIT_ACTIONS } = require('../../../common/constants');
const { uniqueSlug } = require('../../../common/utils/slug');
const { cleanText } = require('../../../common/utils/sanitize');
const workspaceRepository = require('../repository/workspace.repository');
const memberRepository = require('../repository/workspaceMember.repository');
const auditLogService = require('../../auditLogs/service/auditLog.service');
const presence = require('../../../realtime/presence');
const { serializeWorkspace } = require('../serializer');

const Workspace = require('../model/workspace.model');
const WorkspaceMember = require('../model/workspaceMember.model');

/**
 * Creating a workspace also creates the creator's OWNER membership. Both writes
 * happen in a transaction where the deployment supports one, so a workspace can
 * never exist without an owner able to reach it.
 */
async function createWorkspace(user, { name }) {
  const cleanName = cleanText(name, { maxLength: 120 });
  const slug = await uniqueSlug(cleanName, workspaceRepository.slugExists);

  const workspace = await withTransaction(async (session) => {
    const options = session ? { session } : {};
    const [created] = await Workspace.create([{ name: cleanName, slug, owner: user._id }], options);
    await WorkspaceMember.create(
      [{ workspace: created._id, user: user._id, role: WORKSPACE_ROLES.OWNER, joinedAt: new Date() }],
      options,
    );
    return created.toObject();
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: user._id,
    action: AUDIT_ACTIONS.WORKSPACE_CREATED,
    resource: 'workspace',
    resourceId: workspace._id,
    metadata: { name: cleanName, slug },
  });

  return serializeWorkspace(workspace, { role: WORKSPACE_ROLES.OWNER, permissions: [] });
}

/** Lists only the workspaces the caller actually belongs to. */
async function listMyWorkspaces(userId) {
  const memberships = await memberRepository.findByUser(userId);
  if (!memberships.length) return [];

  const workspaces = await workspaceRepository.findByIds(memberships.map((m) => m.workspace));
  const byId = new Map(workspaces.map((w) => [String(w._id), w]));

  return memberships
    .map((m) => {
      const workspace = byId.get(String(m.workspace));
      return workspace ? serializeWorkspace(workspace, m) : null;
    })
    .filter(Boolean);
}

async function getWorkspace(workspace, member) {
  const [memberCount, onlineAgents] = await Promise.all([
    memberRepository.countDocuments({ workspace: workspace._id, isActive: true }),
    presence.countOnlineAgents(workspace._id).catch(() => 0),
  ]);
  return { ...serializeWorkspace(workspace, member), memberCount, onlineAgents };
}

async function updateWorkspace(workspace, actor, payload) {
  const update = {};
  if (payload.name !== undefined) update.name = cleanText(payload.name, { maxLength: 120 });

  // Settings are merged key by key so a partial PATCH never wipes siblings.
  if (payload.settings) {
    Object.entries(payload.settings).forEach(([key, value]) => {
      update[`settings.${key}`] = value;
    });
  }

  const updated = await workspaceRepository.updateById(workspace._id, { $set: update });
  if (!updated) throw new NotFoundError('Workspace not found');

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: payload.settings ? AUDIT_ACTIONS.SETTINGS_UPDATED : AUDIT_ACTIONS.WORKSPACE_UPDATED,
    resource: 'workspace',
    resourceId: workspace._id,
    metadata: { changed: Object.keys(update) },
  });

  return serializeWorkspace(updated);
}

/** Only the workspace owner-of-record may hand the workspace over. */
async function transferOwnership(workspace, actor, newOwnerMemberId) {
  if (String(workspace.owner) !== String(actor._id)) {
    throw new ForbiddenError('Only the workspace owner can transfer ownership');
  }

  const target = await memberRepository.findById(workspace._id, newOwnerMemberId);
  if (!target || !target.isActive) throw new NotFoundError('Member not found');

  await memberRepository.updateById(workspace._id, target._id, { $set: { role: WORKSPACE_ROLES.OWNER } });
  await workspaceRepository.updateById(workspace._id, { $set: { owner: target.user } });

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
    resource: 'workspace',
    resourceId: workspace._id,
    metadata: { transferredTo: String(target.user) },
  });

  return { transferred: true, newOwnerId: String(target.user) };
}

const getPresence = async (workspaceId) => ({ agents: await presence.listWorkspacePresence(workspaceId) });

module.exports = {
  createWorkspace,
  listMyWorkspaces,
  getWorkspace,
  updateWorkspace,
  transferOwnership,
  getPresence,
};
