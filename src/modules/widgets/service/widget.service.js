'use strict';

const { NotFoundError, BadRequestError } = require('../../../common/errors');
const { AUDIT_ACTIONS } = require('../../../common/constants');
const { parsePage, pageMeta } = require('../../../common/utils/pagination');
const { requireObjectId } = require('../../../common/utils/objectId');
const { cleanText } = require('../../../common/utils/sanitize');
const { generatePublicKey } = require('../../../common/utils/crypto');
const widgetRepository = require('../repository/widget.repository');
const websiteRepository = require('../../websites/repository/website.repository');
const auditLogService = require('../../auditLogs/service/auditLog.service');
const emitter = require('../../../realtime/emitter');
const widgetCacheService = require('./widgetCache.service');
const { serializeWidget } = require('../serializer');

/** Flattens a nested settings patch into dotted `$set` paths. */
function flattenSettings(settings, prefix = 'settings') {
  const out = {};
  Object.entries(settings || {}).forEach(([key, value]) => {
    const path = `${prefix}.${key}`;
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(out, flattenSettings(value, path));
    } else {
      out[path] = value;
    }
  });
  return out;
}

async function createWidget(workspace, actor, payload) {
  // The websiteId comes from the client, so it must be re-verified against the
  // tenant before it is stored on the widget.
  const website = await websiteRepository.findOneInWorkspace(
    workspace._id,
    requireObjectId(payload.websiteId, 'Website'),
  );
  if (!website) throw new NotFoundError('Website not found');

  const widget = await widgetRepository.create({
    workspace: workspace._id,
    website: website._id,
    name: cleanText(payload.name, { maxLength: 120 }),
    publicKey: generatePublicKey(),
    settings: payload.settings || {},
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.WIDGET_CREATED,
    resource: 'widget',
    resourceId: widget._id,
    metadata: { websiteId: String(website._id), name: widget.name },
  });

  return serializeWidget(widget.toObject());
}

async function listWidgets(workspaceId, query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspaceId, deletedAt: null };
  if (query.websiteId) filter.website = requireObjectId(query.websiteId, 'Website');
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  const { items, total } = await widgetRepository.paginate({ filter, skip, limit });
  return { data: items.map(serializeWidget), meta: pageMeta({ total, page, limit }) };
}

async function getWidget(workspaceId, widgetId) {
  const widget = await widgetRepository.findOneInWorkspace(workspaceId, requireObjectId(widgetId, 'Widget'));
  if (!widget) throw new NotFoundError('Widget not found');
  return serializeWidget(widget);
}

async function updateWidget(workspace, actor, widgetId, payload) {
  const id = requireObjectId(widgetId, 'Widget');
  const existing = await widgetRepository.findOneInWorkspace(workspace._id, id);
  if (!existing) throw new NotFoundError('Widget not found');

  const update = {};
  if (payload.name !== undefined) update.name = cleanText(payload.name, { maxLength: 120 });
  if (payload.isActive !== undefined) update.isActive = payload.isActive;
  if (payload.settings) Object.assign(update, flattenSettings(payload.settings));
  if (!Object.keys(update).length) throw new BadRequestError('No changes supplied');

  const widget = await widgetRepository.updateInWorkspace(workspace._id, id, { $set: update });

  // Cache invalidation is mandatory here: the widget frontend reads its config
  // from Redis and would otherwise serve stale branding for up to the TTL.
  await widgetCacheService.invalidate(widget.publicKey);
  emitter.toWorkspace(workspace._id, emitter.EVENTS.WIDGET_CONFIG_UPDATED, {
    widgetId: String(widget._id),
    publicKey: widget.publicKey,
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.WIDGET_UPDATED,
    resource: 'widget',
    resourceId: widget._id,
    metadata: { changed: Object.keys(update) },
  });

  return serializeWidget(widget);
}

/** Rotating the key immediately breaks every embed using the old one. */
async function rotatePublicKey(workspace, actor, widgetId) {
  const id = requireObjectId(widgetId, 'Widget');
  const existing = await widgetRepository.findOneInWorkspace(workspace._id, id);
  if (!existing) throw new NotFoundError('Widget not found');

  const widget = await widgetRepository.updateInWorkspace(workspace._id, id, {
    $set: { publicKey: generatePublicKey() },
  });

  await Promise.all([
    widgetCacheService.invalidate(existing.publicKey),
    widgetCacheService.invalidate(widget.publicKey),
  ]);

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.WIDGET_KEY_ROTATED,
    resource: 'widget',
    resourceId: widget._id,
    metadata: {},
  });

  return serializeWidget(widget);
}

async function deleteWidget(workspace, actor, widgetId) {
  const widget = await widgetRepository.softDelete(workspace._id, requireObjectId(widgetId, 'Widget'));
  if (!widget) throw new NotFoundError('Widget not found');

  await widgetCacheService.invalidate(widget.publicKey);
  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.WIDGET_DELETED,
    resource: 'widget',
    resourceId: widget._id,
    metadata: { name: widget.name },
  });

  return { deleted: true, widgetId: String(widget._id) };
}

module.exports = {
  createWidget,
  listWidgets,
  getWidget,
  updateWidget,
  rotatePublicKey,
  deleteWidget,
  flattenSettings,
};
