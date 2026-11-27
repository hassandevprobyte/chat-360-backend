// Configs
const env = require("../config/env");
const redis = require("../config/redis");

// Common
const { STATUSES } = require("../common/constants");

const statusKey = (workspaceId, userId) => redis.redisKey("presence", String(workspaceId), String(userId));
const membersKey = (workspaceId) => redis.redisKey("presence", "members", String(workspaceId));
const socketsKey = (workspaceId, userId) => redis.redisKey("presence", "sockets", String(workspaceId), String(userId));

const setStatus = async (workspaceId, userId, status = STATUSES.PRESENCE.ONLINE) => {
  const redis = redis.getRedis();
  const payload = JSON.stringify({ status, updatedAt: new Date().toISOString() });
  await Promise.all([
    redis.set(statusKey(workspaceId, userId), payload, "EX", env.presence.ttl),
    redis.sadd(membersKey(workspaceId), String(userId)),
    redis.expire(membersKey(workspaceId), 86400),
  ]);
  return status;
};

const heartbeat = async (workspaceId, userId) => {
  const redis = redis.getRedis();
  const current = await redis.get(statusKey(workspaceId, userId));
  const status = current ? JSON.parse(current).status : STATUSES.PRESENCE.ONLINE;
  return setStatus(workspaceId, userId, status);
};

const getStatus = async (workspaceId, userId) => {
  const raw = await redis.getRedis().get(statusKey(workspaceId, userId));
  if (!raw) return { status: STATUSES.PRESENCE.OFFLINE, updatedAt: null };
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { status: STATUSES.PRESENCE.OFFLINE, updatedAt: null };
  }
};

const listWorkspacePresence = async (workspaceId) => {
  const redis = redis.getRedis();
  const userIds = await redis.smembers(membersKey(workspaceId));
  if (!userIds.length) return [];

  const values = await redis.mget(userIds.map((id) => statusKey(workspaceId, id)));
  const stale = [];
  const presence = [];

  userIds.forEach((userId, index) => {
    const raw = values[index];
    if (!raw) {
      stale.push(userId);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      presence.push({ userId, status: parsed.status, updatedAt: parsed.updatedAt });
    } catch (err) {
      stale.push(userId);
    }
  });

  if (stale.length) {
    redis.srem(membersKey(workspaceId), ...stale).catch(() => {});
  }
  return presence;
};

const countOnlineAgents = async (workspaceId) => {
  const presence = await listWorkspacePresence(workspaceId);
  return presence.filter((p) => p.status === STATUSES.PRESENCE.ONLINE).length;
};

const registerSocket = async (workspaceId, userId, socketId) => {
  const redis = redis.getRedis();
  await redis.sadd(socketsKey(workspaceId, userId), socketId);
  await redis.expire(socketsKey(workspaceId, userId), 86400);
  return redis.scard(socketsKey(workspaceId, userId));
};

const unregisterSocket = async (workspaceId, userId, socketId) => {
  const redis = redis.getRedis();
  await redis.srem(socketsKey(workspaceId, userId), socketId);
  return redis.scard(socketsKey(workspaceId, userId));
};

const clearStatus = async (workspaceId, userId) => {
  const redis = redis.getRedis();
  await Promise.all([redis.del(statusKey(workspaceId, userId)), redis.srem(membersKey(workspaceId), String(userId)), redis.del(socketsKey(workspaceId, userId))]);
};

const visitorKey = (workspaceId, visitorId) => redis.redisKey("presence", "visitor", String(workspaceId), String(visitorId));

const setVisitorOnline = async (workspaceId, visitorId, ttl = env.presence.ttl) => {
  await redis.getRedis().set(visitorKey(workspaceId, visitorId), "1", "EX", ttl);
};

const setVisitorOffline = async (workspaceId, visitorId) => {
  await redis.getRedis().del(visitorKey(workspaceId, visitorId));
};

const isVisitorOnline = async (workspaceId, visitorId) => {
  return (await redis.getRedis().exists(visitorKey(workspaceId, visitorId))) === 1;
};

module.exports = {
  setStatus,
  heartbeat,
  getStatus,
  listWorkspacePresence,
  countOnlineAgents,
  registerSocket,
  unregisterSocket,
  clearStatus,
  setVisitorOnline,
  setVisitorOffline,
  isVisitorOnline,
  _keys: { statusKey, membersKey, socketsKey, visitorKey },
  _logger: console,
};
