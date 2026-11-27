// Configs
const socket = require("../config/socket");
const redis = require("../config/redis");

// Realtime
const { ROOMS } = require("./events");

const BRIDGE_CHANNEL = redis.redisKey("realtime", "emit");

exports.emitToRoom = (room, event, payload) => {
  const io = socket.getIO();
  if (io) {
    io.to(room).emit(event, payload);
    return;
  }

  if (redis.isRedisDisabled()) {
    console.log("Realtime emit skipped (no socket server, redis disabled)");
    return;
  }

  redis
    .getRedis("publisher")
    .publish(BRIDGE_CHANNEL, JSON.stringify({ room, event, payload }))
    .catch((err) => console.error({ err, room, event }, "Realtime bridge publish failed"));
};

exports.emitToRooms = (rooms, event, payload) => {
  [...new Set(rooms.filter(Boolean))].forEach((room) => emitToRoom(room, event, payload));
};

exports.subscribeBridge = async () => {
  if (redis.isRedisDisabled()) {
    return;
  }

  const sub = redis.getRedis("subscriber");
  await sub.subscribe(BRIDGE_CHANNEL);

  sub.on("message", (channel, raw) => {
    if (channel !== BRIDGE_CHANNEL) return;
    const io = socket.getIO();
    if (!io) {
      return;
    }

    try {
      const { room, event, payload } = JSON.parse(raw);
      io.local.to(room).emit(event, payload);
    } catch (error) {
      console.log("Realtime bridge message could not be handled".bgRed.white, error);
    }
  });

  console.info("Realtime bridge subscribed".bgGreen.black);
};

exports.toWorkspace = (workspaceId, event, payload) => {
  emitToRoom(ROOMS.workspace(workspaceId), event, payload);
};

exports.toConversation = (conversationId, event, payload) => {
  emitToRoom(ROOMS.conversation(conversationId), event, payload);
};

exports.toVisitor = (visitorId, event, payload) => {
  emitToRoom(ROOMS.visitor(visitorId), event, payload);
};

exports.toUser = (userId, event, payload) => {
  emitToRoom(ROOMS.user(userId), event, payload);
};
