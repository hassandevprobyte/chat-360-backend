'use strict';

const { ConflictError, NotFoundError, ForbiddenError } = require('../../../common/errors');
const {
  ERROR_CODES,
  AUDIT_ACTIONS,
  NOTIFICATION_TYPES,
  PERMISSIONS,
} = require('../../../common/constants');
const { requireObjectId, idEquals } = require('../../../common/utils/objectId');
const conversationRepository = require('../repository/conversation.repository');
const memberRepository = require('../../workspaces/repository/workspaceMember.repository');
const userRepository = require('../../users/repository/user.repository');
const authorizationService = require('../../workspaces/service/authorization.service');
const notificationService = require('../../notifications/service/notification.service');
const auditLogService = require('../../auditLogs/service/auditLog.service');
const emitter = require('../../../realtime/emitter');
const { hydrateConversation } = require('./hydrate.service');

/**
 * Conversation assignment.
 *
 * v1 uses a single strategy: an unassigned queue that agents pull from, either
 * explicitly (claim) or implicitly (first reply). Round-robin and least-busy are
 * deliberately not implemented - they would slot in as alternative
 * implementations of `pickAssignee` without touching anything else here.
 */

/** Every OWNER/AGENT in the workspace, as user ids. */
async function eligibleHandlerIds(workspaceId, { exclude } = {}) {
  const members = await memberRepository.listEligibleHandlers(workspaceId);
  return members
    .map((m) => String(m.user))
    .filter((id) => !exclude || String(exclude) !== id);
}

/** Broadcast + notification fan-out once a conversation has an owner. */
async function announceAssignment({ workspace, conversation, assignee, actorId, implicit }) {
  const payload = await hydrateConversation(workspace._id, conversation);

  // The whole workspace room hears it: every dashboard drops the conversation
  // from its unassigned queue and the assignee's list picks it up.
  emitter.toWorkspace(workspace._id, emitter.EVENTS.CONVERSATION_ASSIGNED, {
    conversationId: String(conversation._id),
    assignedTo: payload ? payload.assignedTo : { id: String(conversation.assignedTo) },
    implicit: Boolean(implicit),
    conversation: payload,
  });
  emitter.toConversation(conversation._id, emitter.EVENTS.CONVERSATION_UPDATED, { conversation: payload });

  // No point telling someone they just claimed something themselves.
  if (!idEquals(actorId, conversation.assignedTo)) {
    await notificationService.notify({
      users: [conversation.assignedTo],
      workspace: workspace._id,
      type: NOTIFICATION_TYPES.CONVERSATION_ASSIGNED,
      title: 'A conversation was assigned to you',
      message: assignee ? `Assigned in ${workspace.name}` : '',
      data: { conversationId: String(conversation._id), workspaceId: String(workspace._id) },
      email: assignee && assignee.email
        ? {
            kind: 'generic',
            to: assignee.email,
            title: 'A conversation was assigned to you',
            message: `You have been assigned a conversation in ${workspace.name}.`,
            actionPath: `/workspaces/${workspace._id}/conversations/${conversation._id}`,
          }
        : null,
    });
  }

  await auditLogService.log({
    workspace: workspace._id,
    actor: actorId || null,
    action: AUDIT_ACTIONS.CONVERSATION_ASSIGNED,
    resource: 'conversation',
    resourceId: conversation._id,
    metadata: { assignedTo: String(conversation.assignedTo), implicit: Boolean(implicit) },
  });

  return payload;
}

/**
 * Explicit claim.
 *
 * The atomicity lives in `claimIfUnassigned`: a single conditional update with
 * `assignedTo: null` in the predicate. Under a concurrent race exactly one
 * caller gets a document back and everybody else gets a 409.
 */
async function claim({ workspace, actor, member }, conversationId) {
  if (!authorizationService.canHandleConversations(member)) {
    throw new ForbiddenError('Your role cannot handle conversations', ERROR_CODES.INSUFFICIENT_ROLE);
  }
  if (!authorizationService.hasPermission(member, PERMISSIONS.CONVERSATION_CLAIM)) {
    throw new ForbiddenError('You cannot claim conversations', ERROR_CODES.INSUFFICIENT_PERMISSION);
  }

  const id = requireObjectId(conversationId, 'Conversation');
  const claimed = await conversationRepository.claimIfUnassigned(workspace._id, id, actor._id);

  if (claimed) {
    const conversation = await announceAssignment({
      workspace,
      conversation: claimed,
      assignee: null,
      actorId: actor._id,
      implicit: false,
    });
    return { conversation, claimed: true };
  }

  // Nothing matched: either it does not exist in this tenant, or somebody won.
  const existing = await conversationRepository.findOneInWorkspace(workspace._id, id);
  if (!existing) throw new NotFoundError('Conversation not found');

  if (idEquals(existing.assignedTo, actor._id)) {
    // Idempotent: claiming what you already own is not an error.
    return { conversation: await hydrateConversation(workspace._id, existing), claimed: false };
  }

  const holder = await userRepository.findById(existing.assignedTo);
  throw new ConflictError(
    `This conversation has already been claimed by ${holder ? holder.name : 'another agent'}`,
    ERROR_CODES.ALREADY_ASSIGNED,
  );
}

/**
 * Implicit claim on the first agent reply. Returns the updated conversation
 * when this call won the race, or null when it was already assigned.
 *
 * Losing the race is not an error: the reply is still delivered, it simply does
 * not change the assignment.
 */
async function autoClaimOnReply({ workspace, actor, conversation }) {
  if (conversation.assignedTo) return null;

  const claimed = await conversationRepository.claimIfUnassigned(
    workspace._id,
    conversation._id,
    actor._id,
  );
  if (!claimed) return null;

  await announceAssignment({
    workspace,
    conversation: claimed,
    assignee: null,
    actorId: actor._id,
    implicit: true,
  });
  return claimed;
}

/** OWNER (or a member holding CONVERSATION_ASSIGN_OTHERS) assigns someone else. */
async function assignToUser({ workspace, actor, member }, conversationId, targetUserId) {
  if (!authorizationService.hasPermission(member, PERMISSIONS.CONVERSATION_ASSIGN_OTHERS)) {
    throw new ForbiddenError('You cannot assign conversations to other members', ERROR_CODES.INSUFFICIENT_PERMISSION);
  }

  const id = requireObjectId(conversationId, 'Conversation');
  const userId = requireObjectId(targetUserId, 'User');

  // The target must be an eligible handler *in this workspace*, verified
  // server-side - assignedTo from the client is never trusted.
  const targetMember = await memberRepository.findActiveMembership(workspace._id, userId);
  if (!targetMember || !authorizationService.canHandleConversations(targetMember)) {
    throw new NotFoundError('That member cannot handle conversations in this workspace');
  }

  const updated = await conversationRepository.assignTo(workspace._id, id, userId);
  if (!updated) throw new NotFoundError('Conversation not found');

  const assignee = await userRepository.findById(userId);
  const conversation = await announceAssignment({
    workspace,
    conversation: updated,
    assignee,
    actorId: actor._id,
    implicit: false,
  });
  return { conversation, claimed: true };
}

/** Returns a conversation to the unassigned queue. */
async function unassign({ workspace, actor, member }, conversationId) {
  const id = requireObjectId(conversationId, 'Conversation');
  const existing = await conversationRepository.findOneInWorkspace(workspace._id, id);
  if (!existing) throw new NotFoundError('Conversation not found');

  const isSelf = idEquals(existing.assignedTo, actor._id);
  if (!isSelf && !authorizationService.hasPermission(member, PERMISSIONS.CONVERSATION_ASSIGN_OTHERS)) {
    throw new ForbiddenError(
      'You can only release conversations assigned to you',
      ERROR_CODES.INSUFFICIENT_PERMISSION,
    );
  }

  const updated = await conversationRepository.assignTo(workspace._id, id, null);
  const conversation = await hydrateConversation(workspace._id, updated);

  emitter.toWorkspace(workspace._id, emitter.EVENTS.CONVERSATION_UPDATED, {
    conversationId: String(id),
    unassigned: true,
    conversation,
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.CONVERSATION_UNASSIGNED,
    resource: 'conversation',
    resourceId: id,
    metadata: { previousAssignee: existing.assignedTo ? String(existing.assignedTo) : null },
  });

  return { conversation };
}

/**
 * Tells every eligible handler that an unassigned conversation is waiting.
 * Called once, when the visitor starts the conversation.
 */
async function announceUnassignedConversation({ workspace, conversation, website, visitor, preview }) {
  const payload = await hydrateConversation(workspace._id, conversation);

  emitter.toWorkspace(workspace._id, emitter.EVENTS.CONVERSATION_CREATED, {
    conversationId: String(conversation._id),
    isUnassigned: true,
    conversation: payload,
  });

  const recipients = await eligibleHandlerIds(workspace._id);
  if (!recipients.length) return payload;

  const users = await userRepository.findByIds(recipients);

  await notificationService.notify({
    users: recipients,
    workspace: workspace._id,
    type: NOTIFICATION_TYPES.NEW_CONVERSATION,
    title: 'New chat waiting in the queue',
    message: preview ? String(preview).slice(0, 140) : 'A visitor started a new conversation.',
    data: {
      conversationId: String(conversation._id),
      workspaceId: String(workspace._id),
      websiteId: String(conversation.website),
      visitorId: String(conversation.visitor),
    },
    email: {
      kind: 'new-conversation',
      to: users.map((u) => u.email).filter(Boolean),
      workspace: { _id: String(workspace._id), name: workspace.name },
      website: website ? { name: website.name } : null,
      visitor: { name: visitor ? visitor.name : null, email: visitor ? visitor.email : null },
      conversationId: String(conversation._id),
      preview,
    },
  });

  return payload;
}

module.exports = {
  eligibleHandlerIds,
  claim,
  autoClaimOnReply,
  assignToUser,
  unassign,
  announceAssignment,
  announceUnassignedConversation,
};
