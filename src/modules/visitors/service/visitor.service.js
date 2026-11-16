'use strict';

const { NotFoundError } = require('../../../common/errors');
const { parsePage, pageMeta } = require('../../../common/utils/pagination');
const { requireObjectId } = require('../../../common/utils/objectId');
const { cleanText, safePageUrl } = require('../../../common/utils/sanitize');
const { generateAnonymousId } = require('../../../common/utils/crypto');
const { parseUserAgent, readCountry } = require('../../../common/utils/userAgent');
const visitorRepository = require('../repository/visitor.repository');
const conversationRepository = require('../../conversations/repository/conversation.repository');
const presence = require('../../../realtime/presence');
const emitter = require('../../../realtime/emitter');
const { serializeVisitor, serializeSelfVisitor } = require('../serializer');

/**
 * Creates or refreshes a visitor from a widget bootstrap.
 *
 * The client may supply its previously issued anonymousId; anything else about
 * the visitor (workspace, website, widget) comes from the widget record, never
 * from the request body.
 */
async function initVisitor({ workspace, website, widget, anonymousId, req, page, referrer, language }) {
  const now = new Date();
  const ua = parseUserAgent(req.get('user-agent'));
  const isReturning = Boolean(anonymousId);

  const set = {
    website: website._id,
    widget: widget._id,
    lastSeenAt: now,
    lastActiveAt: now,
    isOnline: true,
    browser: ua.browser,
    operatingSystem: ua.operatingSystem,
    device: ua.device,
  };
  if (page) set.currentPage = safePageUrl(page);
  if (referrer) set.referrer = safePageUrl(referrer);
  if (language) set.language = cleanText(language, { maxLength: 16 });

  // Country only when the website opted in, and only from a trusted edge header.
  if (website.settings && website.settings.collectVisitorLocation) {
    const country = readCountry(req);
    if (country) set.country = country;
  }

  const visitor = await visitorRepository.upsertByAnonymousId(
    workspace._id,
    anonymousId || generateAnonymousId(),
    {
      set,
      setOnInsert: { firstSeenAt: now },
      inc: isReturning ? { sessionCount: 1 } : {},
    },
  );

  await presence.setVisitorOnline(workspace._id, visitor._id).catch(() => {});
  emitter.toWorkspace(workspace._id, emitter.EVENTS.VISITOR_ONLINE, {
    visitorId: String(visitor._id),
    name: visitor.name || null,
    currentPage: visitor.currentPage || null,
  });

  return visitor;
}

/** Visitor-supplied identity. Only these three fields are ever accepted. */
async function identifyVisitor(workspaceId, visitorId, payload) {
  const set = { isIdentified: true, lastActiveAt: new Date() };
  if (payload.name !== undefined) set.name = cleanText(payload.name, { maxLength: 120 });
  if (payload.email !== undefined) set.email = payload.email ? String(payload.email).toLowerCase() : null;
  if (payload.phone !== undefined) set.phone = cleanText(payload.phone, { maxLength: 40 });
  if (payload.metadata) set.metadata = payload.metadata;

  const visitor = await visitorRepository.updateInWorkspace(workspaceId, visitorId, { $set: set });
  if (!visitor) throw new NotFoundError('Visitor not found');

  emitter.toWorkspace(workspaceId, emitter.EVENTS.VISITOR_UPDATED, {
    visitorId: String(visitor._id),
    name: visitor.name || null,
    email: visitor.email || null,
    isIdentified: true,
  });

  return serializeSelfVisitor(visitor);
}

async function trackActivity(workspaceId, visitorId, { page } = {}) {
  const set = { lastActiveAt: new Date(), lastSeenAt: new Date(), isOnline: true };
  if (page) set.currentPage = safePageUrl(page);

  const visitor = await visitorRepository.updateInWorkspace(workspaceId, visitorId, { $set: set });
  if (!visitor) throw new NotFoundError('Visitor not found');

  await presence.setVisitorOnline(workspaceId, visitorId).catch(() => {});
  if (set.currentPage) {
    emitter.toWorkspace(workspaceId, emitter.EVENTS.VISITOR_UPDATED, {
      visitorId: String(visitorId),
      currentPage: set.currentPage,
    });
  }
  return { tracked: true };
}

async function markOffline(workspaceId, visitorId) {
  await presence.setVisitorOffline(workspaceId, visitorId).catch(() => {});
  await visitorRepository.updateInWorkspace(workspaceId, visitorId, { $set: { isOnline: false } });
  emitter.toWorkspace(workspaceId, emitter.EVENTS.VISITOR_OFFLINE, { visitorId: String(visitorId) });
}

/* ------------------------------- dashboard -------------------------------- */

async function listVisitors(workspaceId, query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspaceId };
  if (query.websiteId) filter.website = requireObjectId(query.websiteId, 'Website');
  if (query.isOnline !== undefined) filter.isOnline = query.isOnline;
  if (query.isIdentified !== undefined) filter.isIdentified = query.isIdentified;
  if (query.search) {
    const rx = { $regex: cleanText(query.search, { maxLength: 60 }), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const { items, total } = await visitorRepository.paginate({ filter, skip, limit });
  return { data: items.map(serializeVisitor), meta: pageMeta({ total, page, limit }) };
}

async function getVisitor(workspaceId, visitorId) {
  const visitor = await visitorRepository.findOneInWorkspace(
    workspaceId,
    requireObjectId(visitorId, 'Visitor'),
  );
  if (!visitor) throw new NotFoundError('Visitor not found');

  const [conversationCount, online] = await Promise.all([
    conversationRepository.countDocuments({ workspace: workspaceId, visitor: visitor._id }),
    presence.isVisitorOnline(workspaceId, visitor._id).catch(() => false),
  ]);

  return { ...serializeVisitor({ ...visitor, isOnline: online || visitor.isOnline }), conversationCount };
}

module.exports = {
  initVisitor,
  identifyVisitor,
  trackActivity,
  markOffline,
  listVisitors,
  getVisitor,
};
