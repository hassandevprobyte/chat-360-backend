'use strict';

const { ConflictError, NotFoundError, BadRequestError } = require('../../../common/errors');
const { ERROR_CODES, PERMISSIONS } = require('../../../common/constants');
const { parsePage, pageMeta } = require('../../../common/utils/pagination');
const { requireObjectId } = require('../../../common/utils/objectId');
const { cleanText } = require('../../../common/utils/sanitize');
const shortcutRepository = require('../repository/messageShortcut.repository');
const authorizationService = require('../../workspaces/service/authorization.service');
const { serializeShortcut } = require('../serializer');

const MAX_SHORTCUTS_PER_USER = 300;

/**
 * Normalises the trigger: a leading slash is accepted for convenience (the UI
 * shows "/pricing") but is never stored, and everything is lowercased so
 * matching in the composer is case-insensitive.
 */
function normalizeShortcut(value) {
  const cleaned = cleanText(value, { maxLength: 41 }) || '';
  const withoutSlash = cleaned.replace(/^\/+/, '').trim().toLowerCase();
  if (!withoutSlash) throw new BadRequestError('A shortcut trigger is required');
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(withoutSlash)) {
    throw new BadRequestError('Shortcuts may only contain letters, numbers, dots, dashes and underscores');
  }
  return withoutSlash.slice(0, 40);
}

const assertCanManage = (member) => {
  // Both OWNER and AGENT keep personal shortcuts; OWNER holds every permission.
  if (!authorizationService.hasPermission(member, PERMISSIONS.SHORTCUT_MANAGE_OWN)) {
    throw new NotFoundError('Shortcut not found');
  }
};

async function createShortcut({ workspace, actor, member }, payload) {
  assertCanManage(member);

  const shortcut = normalizeShortcut(payload.shortcut);
  const content = cleanText(payload.content, { maxLength: 4000 });
  if (!content) throw new BadRequestError('Shortcut content is required');

  const count = await shortcutRepository.countDocuments({ workspace: workspace._id, user: actor._id });
  if (count >= MAX_SHORTCUTS_PER_USER) {
    throw new BadRequestError(`You can store at most ${MAX_SHORTCUTS_PER_USER} shortcuts per workspace`);
  }

  if (await shortcutRepository.findByShortcut(workspace._id, actor._id, shortcut)) {
    throw new ConflictError(`You already have a /${shortcut} shortcut in this workspace`, ERROR_CODES.ALREADY_EXISTS);
  }

  try {
    const created = await shortcutRepository.create({
      workspace: workspace._id,
      user: actor._id,
      shortcut,
      content,
      isActive: payload.isActive !== undefined ? payload.isActive : true,
    });
    return serializeShortcut(created.toObject());
  } catch (err) {
    // { workspace, user, shortcut } is uniquely indexed - that index, not the
    // check above, is the actual guarantee.
    if (err.code === 11000) {
      throw new ConflictError(`You already have a /${shortcut} shortcut in this workspace`, ERROR_CODES.ALREADY_EXISTS);
    }
    throw err;
  }
}

/**
 * The composer list. Returns the caller's own shortcuts only - there is no
 * endpoint that exposes another agent's canned responses.
 */
async function listShortcuts({ workspace, actor, member }, query = {}) {
  assertCanManage(member);

  if (query.all) {
    const items = await shortcutRepository.listForUser(workspace._id, actor._id, {
      activeOnly: query.isActive !== false,
    });
    return { data: items.map(serializeShortcut), meta: { total: items.length } };
  }

  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspace._id, user: actor._id };
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) {
    const rx = { $regex: cleanText(query.search, { maxLength: 40 }), $options: 'i' };
    filter.$or = [{ shortcut: rx }, { content: rx }];
  }

  const { items, total } = await shortcutRepository.paginate({ filter, skip, limit });
  return { data: items.map(serializeShortcut), meta: pageMeta({ total, page, limit }) };
}

async function getShortcut({ workspace, actor, member }, shortcutId) {
  assertCanManage(member);
  const found = await shortcutRepository.findOneForUser(
    workspace._id,
    actor._id,
    requireObjectId(shortcutId, 'Shortcut'),
  );
  // A shortcut belonging to another user is reported as missing, never as
  // forbidden: its existence is not the caller's business.
  if (!found) throw new NotFoundError('Shortcut not found');
  return serializeShortcut(found);
}

async function updateShortcut({ workspace, actor, member }, shortcutId, payload) {
  assertCanManage(member);
  const id = requireObjectId(shortcutId, 'Shortcut');

  const update = {};
  if (payload.shortcut !== undefined) {
    const next = normalizeShortcut(payload.shortcut);
    const clash = await shortcutRepository.findByShortcut(workspace._id, actor._id, next);
    if (clash && String(clash._id) !== String(id)) {
      throw new ConflictError(`You already have a /${next} shortcut in this workspace`, ERROR_CODES.ALREADY_EXISTS);
    }
    update.shortcut = next;
  }
  if (payload.content !== undefined) {
    const content = cleanText(payload.content, { maxLength: 4000 });
    if (!content) throw new BadRequestError('Shortcut content cannot be empty');
    update.content = content;
  }
  if (payload.isActive !== undefined) update.isActive = payload.isActive;
  if (!Object.keys(update).length) throw new BadRequestError('No changes supplied');

  const updated = await shortcutRepository.updateForUser(workspace._id, actor._id, id, { $set: update });
  if (!updated) throw new NotFoundError('Shortcut not found');
  return serializeShortcut(updated);
}

async function deleteShortcut({ workspace, actor, member }, shortcutId) {
  assertCanManage(member);
  const removed = await shortcutRepository.deleteForUser(
    workspace._id,
    actor._id,
    requireObjectId(shortcutId, 'Shortcut'),
  );
  if (!removed) throw new NotFoundError('Shortcut not found');
  return { deleted: true, shortcutId: String(removed._id) };
}

/**
 * Usage telemetry, called when a message is sent with `shortcutId`.
 *
 * Selecting a shortcut in the dashboard only inserts text into the composer;
 * nothing is sent until the agent presses Send, which is why usage is recorded
 * here at send time and not at selection time.
 */
const recordUsage = (workspaceId, userId, shortcutId) =>
  shortcutRepository
    .incrementUsage(workspaceId, userId, requireObjectId(shortcutId, 'Shortcut'))
    .catch(() => null);

module.exports = {
  MAX_SHORTCUTS_PER_USER,
  normalizeShortcut,
  createShortcut,
  listShortcuts,
  getShortcut,
  updateShortcut,
  deleteShortcut,
  recordUsage,
};
