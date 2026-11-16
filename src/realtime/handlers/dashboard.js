'use strict';

const logger = require('../../common/logger');
const { PRESENCE_STATUS } = require('../../common/constants');
const presence = require('../presence');
const emitter = require('../emitter');
const { EVENTS, ROOMS } = require('../events');
const { joinWorkspace } = require('../auth');
const conversationRepository = require('../../modules/conversations/repository/conversation.repository');
const { requireObjectId } = require('../../common/utils/objectId');

const ack = (cb, payload) => typeof cb === 'function' && cb(payload);
const fail = (cb, message) => ack(cb, { ok: false, error: message });

/**
 * Dashboard (agent/owner) socket.
 *
 * Rooms:
 *   user:{id}          - always joined; personal notifications
 *   workspace:{id}     - joined per proven membership; inbox events
 *   conversation:{id}  - joined while viewing a thread; typing / read receipts
 */
function registerDashboardHandlers(io, socket) {
  const { user } = socket.data;
  socket.join(ROOMS.user(user.id));

  const presenceEvent = (status) =>
    status === PRESENCE_STATUS.ONLINE ? EVENTS.AGENT_ONLINE
      : status === PRESENCE_STATUS.AWAY ? EVENTS.AGENT_AWAY
        : EVENTS.AGENT_OFFLINE;

  async function enterWorkspace(workspaceId) {
    socket.join(ROOMS.workspace(workspaceId));
    await presence.registerSocket(workspaceId, user.id, socket.id);
    await presence.setStatus(workspaceId, user.id, PRESENCE_STATUS.ONLINE);
    emitter.toWorkspace(workspaceId, EVENTS.AGENT_ONLINE, {
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
      status: PRESENCE_STATUS.ONLINE,
    });
  }

  // Workspaces proven during the handshake are entered immediately.
  for (const workspaceId of socket.data.memberships.keys()) {
    enterWorkspace(workspaceId).catch((err) => logger.warn({ err }, 'enterWorkspace failed'));
  }

  socket.on('workspace:join', async ({ workspaceId } = {}, cb) => {
    try {
      const { workspace } = await joinWorkspace(socket, requireObjectId(workspaceId, 'Workspace'));
      await enterWorkspace(String(workspace._id));
      ack(cb, { ok: true, workspaceId: String(workspace._id) });
    } catch (err) {
      fail(cb, err.message);
    }
  });

  socket.on('workspace:leave', async ({ workspaceId } = {}, cb) => {
    const id = String(workspaceId || '');
    if (!socket.data.memberships.has(id)) return fail(cb, 'Not joined');
    socket.leave(ROOMS.workspace(id));
    socket.data.memberships.delete(id);
    await leaveWorkspacePresence(id);
    return ack(cb, { ok: true });
  });

  /** A thread room is only joinable for conversations in a joined workspace. */
  socket.on('conversation:join', async ({ workspaceId, conversationId } = {}, cb) => {
    try {
      const wsId = String(workspaceId || '');
      if (!socket.data.memberships.has(wsId)) throw new Error('Join the workspace first');
      const conversation = await conversationRepository.findOneInWorkspace(
        wsId,
        requireObjectId(conversationId, 'Conversation'),
      );
      if (!conversation) throw new Error('Conversation not found');
      socket.join(ROOMS.conversation(conversationId));
      ack(cb, { ok: true });
    } catch (err) {
      fail(cb, err.message);
    }
  });

  socket.on('conversation:leave', ({ conversationId } = {}, cb) => {
    if (conversationId) socket.leave(ROOMS.conversation(conversationId));
    ack(cb, { ok: true });
  });

  /** Typing is relayed only to rooms this socket has actually joined. */
  const relayTyping = (event) => async ({ conversationId } = {}) => {
    if (!conversationId || !socket.rooms.has(ROOMS.conversation(conversationId))) return;
    const payload = { conversationId: String(conversationId), userId: user.id, name: user.name };
    socket.to(ROOMS.conversation(conversationId)).emit(event, payload);

    // The visitor sees "Agent is typing" by display name only.
    const doc = await findConversationAcrossJoined(conversationId);
    if (doc) emitter.toVisitor(doc.visitor, event, { conversationId: String(conversationId), agent: { name: user.name } });
  };

  async function findConversationAcrossJoined(conversationId) {
    for (const wsId of socket.data.memberships.keys()) {
      // eslint-disable-next-line no-await-in-loop
      const doc = await conversationRepository.findOneInWorkspace(wsId, conversationId).catch(() => null);
      if (doc) return doc;
    }
    return null;
  }

  socket.on('typing:start', relayTyping(EVENTS.TYPING_START));
  socket.on('typing:stop', relayTyping(EVENTS.TYPING_STOP));

  socket.on('presence:update', async ({ workspaceId, status } = {}, cb) => {
    const id = String(workspaceId || '');
    if (!socket.data.memberships.has(id)) return fail(cb, 'Not joined');
    const next = Object.values(PRESENCE_STATUS).includes(status) ? status : PRESENCE_STATUS.ONLINE;
    await presence.setStatus(id, user.id, next);
    emitter.toWorkspace(id, presenceEvent(next), { userId: user.id, name: user.name, status: next });
    return ack(cb, { ok: true, status: next });
  });

  socket.on('presence:heartbeat', async ({ workspaceId } = {}) => {
    const id = String(workspaceId || '');
    if (socket.data.memberships.has(id)) await presence.heartbeat(id, user.id).catch(() => {});
  });

  async function leaveWorkspacePresence(workspaceId) {
    const remaining = await presence.unregisterSocket(workspaceId, user.id, socket.id).catch(() => 0);
    if (remaining > 0) return; // other tabs still open
    await presence.clearStatus(workspaceId, user.id).catch(() => {});
    emitter.toWorkspace(workspaceId, EVENTS.AGENT_OFFLINE, { userId: user.id, status: PRESENCE_STATUS.OFFLINE });
  }

  socket.on('disconnect', async () => {
    for (const workspaceId of socket.data.memberships.keys()) {
      // eslint-disable-next-line no-await-in-loop
      await leaveWorkspacePresence(workspaceId);
    }
  });
}

module.exports = { registerDashboardHandlers };
