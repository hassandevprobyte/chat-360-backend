'use strict';

const { NotFoundError, BadRequestError } = require('../../../common/errors');
const {
  AUDIT_ACTIONS,
  CONVERSATION_STATUS,
} = require('../../../common/constants');
const { parsePage, pageMeta } = require('../../../common/utils/pagination');
const { requireObjectId } = require('../../../common/utils/objectId');
const { cleanText } = require('../../../common/utils/sanitize');
const userRepository = require('../../users/repository/user.repository');
const workspaceRepository = require('../../workspaces/repository/workspace.repository');
const memberRepository = require('../../workspaces/repository/workspaceMember.repository');
const websiteRepository = require('../../websites/repository/website.repository');
const conversationRepository = require('../../conversations/repository/conversation.repository');
const visitorRepository = require('../../visitors/repository/visitor.repository');
const auditLogService = require('../../auditLogs/service/auditLog.service');
const emitter = require('../../../realtime/emitter');
const { serializeUser } = require('../../users/serializer');
const { serializeWorkspace, serializeMember } = require('../../workspaces/serializer');
const { hydrateConversations } = require('../../conversations/service/hydrate.service');
const messageService = require('../../messages/service/message.service');

/**
 * Platform administration.
 *
 * A Super Admin operates across tenants for support and abuse handling. Every
 * read that touches customer data is written to the audit log so the access
 * trail is reviewable. Nothing here bypasses the repositories' workspace
 * scoping - the workspace id is simply supplied by the admin instead of a
 * membership record.
 */

/* --------------------------------- users --------------------------------- */

async function listUsers(query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = {};
  if (query.platformRole) filter.platformRole = query.platformRole;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) {
    const rx = { $regex: cleanText(query.search, { maxLength: 60 }), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const { items, total } = await userRepository.paginate({ filter, skip, limit });
  return { data: items.map(serializeUser), meta: pageMeta({ total, page, limit }) };
}

async function getUser(userId) {
  const user = await userRepository.findById(requireObjectId(userId, 'User'));
  if (!user) throw new NotFoundError('User not found');
  const memberships = await memberRepository.findByUser(user._id);
  const workspaces = await workspaceRepository.findByIds(memberships.map((m) => m.workspace));
  const wsMap = new Map(workspaces.map((w) => [String(w._id), w]));
  return {
    ...serializeUser(user),
    memberships: memberships.map((m) => ({
      workspace: serializeWorkspace(wsMap.get(String(m.workspace))),
      role: m.role,
      isActive: m.isActive !== false,
    })),
  };
}

async function setUserActive(actor, userId, isActive) {
  const id = requireObjectId(userId, 'User');
  if (String(id) === String(actor._id)) throw new BadRequestError('You cannot change your own status');
  const user = await userRepository.updateById(id, { $set: { isActive } });
  if (!user) throw new NotFoundError('User not found');
  // Bumping the token version invalidates every issued access token at once.
  if (!isActive) await userRepository.incrementTokenVersion(id);
  await auditLogService.log({
    actor: actor._id,
    actorType: 'SUPER_ADMIN',
    action: isActive ? 'super_admin.user_reactivated' : 'super_admin.user_deactivated',
    resource: 'user',
    resourceId: id,
  });
  return serializeUser(user);
}

/* ------------------------------- workspaces ------------------------------- */

async function listWorkspaces(query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = {};
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) {
    const rx = { $regex: cleanText(query.search, { maxLength: 60 }), $options: 'i' };
    filter.$or = [{ name: rx }, { slug: rx }];
  }
  const { items, total } = await workspaceRepository.paginate({ filter, skip, limit });
  const owners = await userRepository.findByIds(items.map((w) => w.owner));
  const ownerMap = new Map(owners.map((u) => [String(u._id), u]));
  return {
    data: items.map((w) => ({
      ...serializeWorkspace(w),
      owner: ownerMap.has(String(w.owner))
        ? { id: String(w.owner), name: ownerMap.get(String(w.owner)).name, email: ownerMap.get(String(w.owner)).email }
        : { id: String(w.owner) },
    })),
    meta: pageMeta({ total, page, limit }),
  };
}

async function loadWorkspace(workspaceId) {
  const workspace = await workspaceRepository.findById(requireObjectId(workspaceId, 'Workspace'));
  if (!workspace) throw new NotFoundError('Workspace not found');
  return workspace;
}

async function getWorkspace(actor, workspaceId) {
  const workspace = await loadWorkspace(workspaceId);
  const [members, websites, conversations, open, visitors] = await Promise.all([
    memberRepository.countDocuments({ workspace: workspace._id, isActive: true }),
    websiteRepository.countDocuments({ workspace: workspace._id, deletedAt: null }),
    conversationRepository.countDocuments({ workspace: workspace._id }),
    conversationRepository.countDocuments({ workspace: workspace._id, status: CONVERSATION_STATUS.OPEN }),
    visitorRepository.countDocuments({ workspace: workspace._id }),
  ]);

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    actorType: 'SUPER_ADMIN',
    action: AUDIT_ACTIONS.SUPER_ADMIN_VIEWED_WORKSPACE,
    resource: 'workspace',
    resourceId: workspace._id,
  });

  return {
    ...serializeWorkspace(workspace),
    stats: { members, websites, conversations, openConversations: open, visitors },
  };
}

async function listWorkspaceMembers(workspaceId, query = {}) {
  const workspace = await loadWorkspace(workspaceId);
  const { page, limit, skip } = parsePage(query);
  const { items, total } = await memberRepository.paginate({ filter: { workspace: workspace._id }, skip, limit });
  const users = await userRepository.findByIds(items.map((m) => m.user));
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  return {
    data: items.map((m) => serializeMember(m, userMap.get(String(m.user)))),
    meta: pageMeta({ total, page, limit }),
  };
}

async function setWorkspaceActive(actor, workspaceId, isActive, reason) {
  const workspace = await loadWorkspace(workspaceId);
  const updated = await workspaceRepository.updateById(workspace._id, {
    $set: { isActive, suspendedAt: isActive ? null : new Date() },
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    actorType: 'SUPER_ADMIN',
    action: isActive ? AUDIT_ACTIONS.WORKSPACE_REACTIVATED : AUDIT_ACTIONS.WORKSPACE_SUSPENDED,
    resource: 'workspace',
    resourceId: workspace._id,
    metadata: { reason: reason ? cleanText(reason, { maxLength: 200 }) : null },
  });

  // Connected dashboards learn immediately; the HTTP layer rejects them on the
  // next request via resolveWorkspace.
  emitter.toWorkspace(workspace._id, emitter.EVENTS.CONVERSATION_UPDATED, {
    workspaceSuspended: !isActive,
  });

  return serializeWorkspace(updated);
}

/* ------------------------------ conversations ----------------------------- */

async function listWorkspaceConversations(actor, workspaceId, query = {}) {
  const workspace = await loadWorkspace(workspaceId);
  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspace._id };
  if (query.status) filter.status = query.status;

  const [rows, total] = await Promise.all([
    conversationRepository.aggregate([
      { $match: filter },
      { $sort: { lastMessageAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    conversationRepository.countDocuments(filter),
  ]);

  return { data: await hydrateConversations(workspace._id, rows), meta: pageMeta({ total, page, limit }) };
}

/** Inspect a single conversation (with messages). Always audited. */
async function inspectConversation(actor, workspaceId, conversationId, query = {}) {
  const workspace = await loadWorkspace(workspaceId);
  const conversation = await conversationRepository.findOneInWorkspace(
    workspace._id,
    requireObjectId(conversationId, 'Conversation'),
  );
  if (!conversation) throw new NotFoundError('Conversation not found');

  // A synthetic OWNER membership grants the same view an owner would have; the
  // Super Admin's identity, not the membership, is what the audit log records.
  const syntheticOwner = { role: 'OWNER', isActive: true, user: actor._id };
  const messages = await messageService.listMessages(workspace._id, syntheticOwner, conversation._id, query);

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    actorType: 'SUPER_ADMIN',
    action: AUDIT_ACTIONS.SUPER_ADMIN_INSPECTED_CONVERSATION,
    resource: 'conversation',
    resourceId: conversation._id,
  });

  const [payload] = await hydrateConversations(workspace._id, [conversation]);
  return { conversation: payload, messages: messages.data, meta: messages.meta };
}

module.exports = {
  listUsers,
  getUser,
  setUserActive,
  listWorkspaces,
  getWorkspace,
  listWorkspaceMembers,
  setWorkspaceActive,
  listWorkspaceConversations,
  inspectConversation,
};
