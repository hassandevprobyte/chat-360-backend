'use strict';

const logger = require('../../../common/logger');
const { PLATFORM_ROLES } = require('../../../common/constants');
const { parsePage, pageMeta } = require('../../../common/utils/pagination');
const { requireObjectId } = require('../../../common/utils/objectId');
const auditLogRepository = require('../repository/auditLog.repository');
const userRepository = require('../../users/repository/user.repository');

/** Keys that must never be written to the audit trail. */
const FORBIDDEN_KEYS = [
  'password', 'newpassword', 'currentpassword', 'passwordhash',
  'token', 'accesstoken', 'refreshtoken', 'visitortoken', 'tokenhash',
  'secret', 'apikey', 'authorization', 'cookie', 'privatekey',
];

/** Recursively strips sensitive keys and caps depth/size of metadata. */
function sanitizeMetadata(value, depth = 0) {
  if (depth > 3 || value === null || value === undefined) return value === undefined ? null : value;
  if (Array.isArray(value)) return value.slice(0, 25).map((v) => sanitizeMetadata(v, depth + 1));
  if (typeof value === 'object') {
    if (value instanceof Date) return value;
    const out = {};
    Object.entries(value)
      .slice(0, 30)
      .forEach(([k, v]) => {
        if (FORBIDDEN_KEYS.includes(k.toLowerCase())) return;
        out[k] = sanitizeMetadata(v, depth + 1);
      });
    return out;
  }
  if (typeof value === 'string') return value.slice(0, 500);
  return value;
}

/**
 * Fire-and-forget audit write. Auditing must never break the operation that is
 * being audited, so failures are logged rather than thrown.
 */
async function log({ workspace = null, actor = null, actorType, action, resource, resourceId = null, metadata = {} }) {
  try {
    await auditLogRepository.create({
      workspace,
      actor,
      actorType: actorType || (actor ? 'USER' : 'SYSTEM'),
      action,
      resource,
      resourceId,
      metadata: sanitizeMetadata(metadata),
    });
  } catch (err) {
    logger.error({ err, action, resource }, 'Audit log write failed');
  }
}

/** Convenience wrapper that derives the actor from the request. */
const logFromRequest = (req, payload) =>
  log({
    workspace: req.workspaceId || payload.workspace || null,
    actor: req.user ? req.user._id : null,
    actorType: req.user && req.user.platformRole === PLATFORM_ROLES.SUPER_ADMIN ? 'SUPER_ADMIN' : 'USER',
    ...payload,
  });

async function listWorkspaceLogs(workspaceId, query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspaceId };
  if (query.action) filter.action = query.action;
  if (query.resource) filter.resource = query.resource;
  if (query.actor) filter.actor = requireObjectId(query.actor, 'Actor');
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const { items, total } = await auditLogRepository.paginate({ filter, skip, limit });
  const actors = await userRepository.findByIds([...new Set(items.map((i) => i.actor).filter(Boolean))]);
  const actorMap = new Map(actors.map((a) => [String(a._id), a]));

  return {
    data: items.map((item) => ({
      id: String(item._id),
      action: item.action,
      resource: item.resource,
      resourceId: item.resourceId ? String(item.resourceId) : null,
      actorType: item.actorType,
      actor: item.actor
        ? (() => {
            const a = actorMap.get(String(item.actor));
            return a ? { id: String(a._id), name: a.name, avatar: a.avatar || null } : { id: String(item.actor) };
          })()
        : null,
      metadata: item.metadata || {},
      createdAt: item.createdAt,
    })),
    meta: pageMeta({ total, page, limit }),
  };
}

module.exports = { log, logFromRequest, listWorkspaceLogs, sanitizeMetadata };
