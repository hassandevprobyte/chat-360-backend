'use strict';

const { getIO } = require('../config/socket');
const { getRedis, key, isRedisDisabled } = require('../config/redis');
const logger = require('../common/logger');
const { EVENTS, ROOMS } = require('./events');

const BRIDGE_CHANNEL = key('realtime', 'emit');

/**
 * Emits to a room.
 *
 * In an API process the Socket.IO Redis adapter fans the event out to every
 * other API instance. In a worker process there is no io instance, so the
 * payload is published on a Redis channel that API instances re-broadcast
 * locally (see subscribeBridge).
 */
function emitToRoom(room, event, payload) {
  const io = getIO();
  if (io) {
    io.to(room).emit(event, payload);
    return;
  }

  if (isRedisDisabled()) {
    logger.debug({ room, event }, 'Realtime emit skipped (no socket server, redis disabled)');
    return;
  }

  getRedis('publisher')
    .publish(BRIDGE_CHANNEL, JSON.stringify({ room, event, payload }))
    .catch((err) => logger.error({ err, room, event }, 'Realtime bridge publish failed'));
}

function emitToRooms(rooms, event, payload) {
  [...new Set(rooms.filter(Boolean))].forEach((room) => emitToRoom(room, event, payload));
}

/** Called once per API process: re-broadcasts worker-originated events locally. */
async function subscribeBridge() {
  if (isRedisDisabled()) return;
  const sub = getRedis('subscriber');
  await sub.subscribe(BRIDGE_CHANNEL);
  sub.on('message', (channel, raw) => {
    if (channel !== BRIDGE_CHANNEL) return;
    const io = getIO();
    if (!io) return;
    try {
      const { room, event, payload } = JSON.parse(raw);
      // `local` prevents an N-instance amplification loop: every instance
      // already received this pub/sub message.
      io.local.to(room).emit(event, payload);
    } catch (err) {
      logger.error({ err }, 'Realtime bridge message could not be handled');
    }
  });
  logger.info('Realtime bridge subscribed');
}

const toWorkspace = (workspaceId, event, payload) => emitToRoom(ROOMS.workspace(workspaceId), event, payload);
const toConversation = (conversationId, event, payload) => emitToRoom(ROOMS.conversation(conversationId), event, payload);
const toVisitor = (visitorId, event, payload) => emitToRoom(ROOMS.visitor(visitorId), event, payload);
const toUser = (userId, event, payload) => emitToRoom(ROOMS.user(userId), event, payload);

module.exports = {
  EVENTS,
  ROOMS,
  BRIDGE_CHANNEL,
  emitToRoom,
  emitToRooms,
  subscribeBridge,
  toWorkspace,
  toConversation,
  toVisitor,
  toUser,
};
