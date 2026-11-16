'use strict';

const env = require('../config/env');
const { getRedis, key } = require('../config/redis');
const { PRESENCE_STATUS } = require('../common/constants');
const logger = require('../common/logger');

/**
 * Agent presence is ephemeral and lives only in Redis with a TTL. It is never
 * treated as durable state: if Redis loses it, agents simply appear OFFLINE
 * until their next heartbeat.
 */
const statusKey = (workspaceId, userId) => key('presence', String(workspaceId), String(userId));
const membersKey = (workspaceId) => key('presence', 'members', String(workspaceId));
const socketsKey = (workspaceId, userId) => key('presence', 'sockets', String(workspaceId), String(userId));

async function setStatus(workspaceId, userId, status = PRESENCE_STATUS.ONLINE) {
  const redis = getRedis();
  const payload = JSON.stringify({ status, updatedAt: new Date().toISOString() });
  await Promise.all([
    redis.set(statusKey(workspaceId, userId), payload, 'EX', env.presence.ttl),
    redis.sadd(membersKey(workspaceId), String(userId)),
    redis.expire(membersKey(workspaceId), 86400),
  ]);
  return status;
}

async function heartbeat(workspaceId, userId) {
  const redis = getRedis();
  const current = await redis.get(statusKey(workspaceId, userId));
  const status = current ? JSON.parse(current).status : PRESENCE_STATUS.ONLINE;
  return setStatus(workspaceId, userId, status);
}

async function getStatus(workspaceId, userId) {
  const raw = await getRedis().get(statusKey(workspaceId, userId));
  if (!raw) return { status: PRESENCE_STATUS.OFFLINE, updatedAt: null };
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { status: PRESENCE_STATUS.OFFLINE, updatedAt: null };
  }
}

/** Lists presence for a workspace, pruning userIds whose TTL has lapsed. */
async function listWorkspacePresence(workspaceId) {
  const redis = getRedis();
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
}

async function countOnlineAgents(workspaceId) {
  const presence = await listWorkspacePresence(workspaceId);
  return presence.filter((p) => p.status === PRESENCE_STATUS.ONLINE).length;
}

/** Tracks sockets per user so multi-tab agents do not flap to OFFLINE. */
async function registerSocket(workspaceId, userId, socketId) {
  const redis = getRedis();
  await redis.sadd(socketsKey(workspaceId, userId), socketId);
  await redis.expire(socketsKey(workspaceId, userId), 86400);
  return redis.scard(socketsKey(workspaceId, userId));
}

async function unregisterSocket(workspaceId, userId, socketId) {
  const redis = getRedis();
  await redis.srem(socketsKey(workspaceId, userId), socketId);
  return redis.scard(socketsKey(workspaceId, userId));
}

async function clearStatus(workspaceId, userId) {
  const redis = getRedis();
  await Promise.all([
    redis.del(statusKey(workspaceId, userId)),
    redis.srem(membersKey(workspaceId), String(userId)),
    redis.del(socketsKey(workspaceId, userId)),
  ]);
}

/** Visitor presence: TTL-backed, used for the "visitor is on the site" indicator. */
const visitorKey = (workspaceId, visitorId) => key('presence', 'visitor', String(workspaceId), String(visitorId));

async function setVisitorOnline(workspaceId, visitorId, ttl = env.presence.ttl) {
  await getRedis().set(visitorKey(workspaceId, visitorId), '1', 'EX', ttl);
}

async function setVisitorOffline(workspaceId, visitorId) {
  await getRedis().del(visitorKey(workspaceId, visitorId));
}

async function isVisitorOnline(workspaceId, visitorId) {
  return (await getRedis().exists(visitorKey(workspaceId, visitorId))) === 1;
}

module.exports = {
  PRESENCE_STATUS,
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
  _logger: logger,
};
