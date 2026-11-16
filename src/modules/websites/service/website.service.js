'use strict';

const { ConflictError, NotFoundError } = require('../../../common/errors');
const { AUDIT_ACTIONS, WEBSITE_STATUS, ERROR_CODES } = require('../../../common/constants');
const { parsePage, pageMeta } = require('../../../common/utils/pagination');
const { requireObjectId } = require('../../../common/utils/objectId');
const { cleanText, normalizeDomain, domainMatches } = require('../../../common/utils/sanitize');
const websiteRepository = require('../repository/website.repository');
const widgetRepository = require('../../widgets/repository/widget.repository');
const widgetCacheService = require('../../widgets/service/widgetCache.service');
const auditLogService = require('../../auditLogs/service/auditLog.service');
const { serializeWebsite } = require('../serializer');

const dedupeDomains = (domains = []) => [...new Set(domains.map(normalizeDomain).filter(Boolean))];

async function createWebsite(workspace, actor, payload) {
  const domain = normalizeDomain(payload.domain);

  if (await websiteRepository.findByDomain(workspace._id, domain)) {
    throw new ConflictError('This domain is already registered in the workspace', ERROR_CODES.ALREADY_EXISTS);
  }

  const website = await websiteRepository.create({
    workspace: workspace._id,
    name: cleanText(payload.name, { maxLength: 120 }),
    domain,
    allowedDomains: dedupeDomains(payload.allowedDomains),
    settings: payload.settings || {},
  });

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.WEBSITE_CREATED,
    resource: 'website',
    resourceId: website._id,
    metadata: { domain, name: website.name },
  });

  return serializeWebsite(website.toObject());
}

async function listWebsites(workspaceId, query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspaceId, deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.search) filter.$or = [
    { name: { $regex: cleanText(query.search), $options: 'i' } },
    { domain: { $regex: cleanText(query.search), $options: 'i' } },
  ];

  const { items, total } = await websiteRepository.paginate({ filter, skip, limit });
  return { data: items.map(serializeWebsite), meta: pageMeta({ total, page, limit }) };
}

async function getWebsite(workspaceId, websiteId) {
  const website = await websiteRepository.findOneInWorkspace(
    workspaceId,
    requireObjectId(websiteId, 'Website'),
  );
  if (!website) throw new NotFoundError('Website not found');

  const widgetCount = await widgetRepository.countDocuments({
    workspace: workspaceId,
    website: website._id,
    deletedAt: null,
  });
  return { ...serializeWebsite(website), widgetCount };
}

async function updateWebsite(workspace, actor, websiteId, payload) {
  const id = requireObjectId(websiteId, 'Website');
  const update = {};

  if (payload.name !== undefined) update.name = cleanText(payload.name, { maxLength: 120 });
  if (payload.status !== undefined) update.status = payload.status;
  if (payload.allowedDomains !== undefined) update.allowedDomains = dedupeDomains(payload.allowedDomains);
  if (payload.domain !== undefined) {
    const domain = normalizeDomain(payload.domain);
    const clash = await websiteRepository.findByDomain(workspace._id, domain);
    if (clash && String(clash._id) !== String(id)) {
      throw new ConflictError('This domain is already registered in the workspace', ERROR_CODES.ALREADY_EXISTS);
    }
    update.domain = domain;
  }
  if (payload.settings) {
    Object.entries(payload.settings).forEach(([key, value]) => {
      update[`settings.${key}`] = value;
    });
  }

  const website = await websiteRepository.updateInWorkspace(workspace._id, id, { $set: update });
  if (!website) throw new NotFoundError('Website not found');

  // Widget configs embed the website's origin rules, so the cache must go.
  await widgetCacheService.invalidateForWebsite(workspace._id, website._id);

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.WEBSITE_UPDATED,
    resource: 'website',
    resourceId: website._id,
    metadata: { changed: Object.keys(update) },
  });

  return serializeWebsite(website);
}

/**
 * Soft delete: conversations and messages keep referring to the website, so the
 * record must survive. Widgets are deactivated so no new traffic arrives.
 */
async function deleteWebsite(workspace, actor, websiteId) {
  const website = await websiteRepository.softDelete(workspace._id, requireObjectId(websiteId, 'Website'));
  if (!website) throw new NotFoundError('Website not found');

  await widgetRepository.deactivateForWebsite(workspace._id, website._id);
  await widgetCacheService.invalidateForWebsite(workspace._id, website._id);

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.WEBSITE_DELETED,
    resource: 'website',
    resourceId: website._id,
    metadata: { domain: website.domain },
  });

  return { deleted: true, websiteId: String(website._id) };
}

/**
 * Origin check used by the public widget API. Called on every widget request,
 * so it stays a pure function over already-loaded data.
 */
function isOriginAllowed(website, originHost) {
  if (!website) return false;
  if (website.settings && website.settings.enforceOriginCheck === false) return true;
  if (!originHost) return false;
  const candidates = [website.domain, ...(website.allowedDomains || [])];
  return candidates.some((allowed) => domainMatches(originHost, allowed));
}

module.exports = {
  WEBSITE_STATUS,
  createWebsite,
  listWebsites,
  getWebsite,
  updateWebsite,
  deleteWebsite,
  isOriginAllowed,
};
