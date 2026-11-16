'use strict';

/** Dashboard shape. Agents see the visitor profile they are chatting with. */
function serializeVisitor(visitor) {
  if (!visitor) return null;
  return {
    id: String(visitor._id || visitor.id),
    anonymousId: visitor.anonymousId,
    name: visitor.name || null,
    email: visitor.email || null,
    phone: visitor.phone || null,
    isIdentified: Boolean(visitor.isIdentified),
    isOnline: Boolean(visitor.isOnline),
    currentPage: visitor.currentPage || null,
    referrer: visitor.referrer || null,
    browser: visitor.browser || null,
    operatingSystem: visitor.operatingSystem || null,
    device: visitor.device || null,
    country: visitor.country || null,
    language: visitor.language || null,
    sessionCount: visitor.sessionCount || 1,
    metadata: visitor.metadata || {},
    firstSeenAt: visitor.firstSeenAt,
    lastSeenAt: visitor.lastSeenAt,
    lastActiveAt: visitor.lastActiveAt,
  };
}

/** Embedded in conversation payloads. */
function serializeVisitorSummary(visitor) {
  if (!visitor) return null;
  return {
    id: String(visitor._id || visitor.id),
    name: visitor.name || null,
    email: visitor.email || null,
    isOnline: Boolean(visitor.isOnline),
    country: visitor.country || null,
    device: visitor.device || null,
  };
}

/** What the visitor's own widget is told about itself. No internal fields. */
function serializeSelfVisitor(visitor) {
  if (!visitor) return null;
  return {
    id: String(visitor._id || visitor.id),
    anonymousId: visitor.anonymousId,
    name: visitor.name || null,
    email: visitor.email || null,
    phone: visitor.phone || null,
    isIdentified: Boolean(visitor.isIdentified),
  };
}

module.exports = { serializeVisitor, serializeVisitorSummary, serializeSelfVisitor };
