'use strict';

const { serializeUserSummary } = require('../users/serializer');
const { serializeVisitorSummary } = require('../visitors/serializer');

const serializeTag = (tag) =>
  tag && tag.name
    ? { id: String(tag._id || tag.id), name: tag.name, color: tag.color }
    : { id: String(tag) };

/**
 * Dashboard conversation shape. Flat, id-normalised and free of Mongo
 * internals, so the frontend never has to know about ObjectIds or $-operators.
 */
function serializeConversation(conversation, { visitor, assignedTo, tags, website, widget } = {}) {
  if (!conversation) return null;
  const last = conversation.lastMessage || {};

  return {
    id: String(conversation._id || conversation.id),
    workspaceId: String(conversation.workspace),
    websiteId: String(conversation.website),
    widgetId: String(conversation.widget),
    status: conversation.status,
    priority: conversation.priority,
    subject: conversation.subject || null,
    isAssigned: Boolean(conversation.assignedTo),
    assignedTo: assignedTo
      ? serializeUserSummary(assignedTo)
      : conversation.assignedTo
        ? { id: String(conversation.assignedTo) }
        : null,
    assignedAt: conversation.assignedAt || null,
    visitor: visitor ? serializeVisitorSummary(visitor) : { id: String(conversation.visitor) },
    website: website ? { id: String(website._id), name: website.name, domain: website.domain } : undefined,
    widget: widget ? { id: String(widget._id), name: widget.name } : undefined,
    tags: (tags || conversation.tags || []).map(serializeTag),
    lastMessage: last.createdAt
      ? {
          id: last.message ? String(last.message) : null,
          senderType: last.senderType,
          type: last.type,
          preview: last.preview,
          createdAt: last.createdAt,
        }
      : null,
    lastMessageAt: conversation.lastMessageAt,
    messageCount: conversation.messageCount || 0,
    agentUnreadCount: conversation.agentUnreadCount || 0,
    firstResponseAt: conversation.firstResponseAt || null,
    closedAt: conversation.closedAt || null,
    reopenedAt: conversation.reopenedAt || null,
    startedPage: conversation.startedPage || null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

/**
 * Visitor-facing shape. No assignee identity beyond a display name, no tags, no
 * internal counters, no website/widget ids.
 */
function serializeConversationForVisitor(conversation, { assignedTo } = {}) {
  if (!conversation) return null;
  const last = conversation.lastMessage || {};
  return {
    id: String(conversation._id || conversation.id),
    status: conversation.status,
    agent: assignedTo ? { name: assignedTo.name, avatar: assignedTo.avatar || null } : null,
    lastMessage: last.createdAt
      ? { senderType: last.senderType, preview: last.preview, createdAt: last.createdAt }
      : null,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount: conversation.visitorUnreadCount || 0,
    createdAt: conversation.createdAt,
  };
}

module.exports = { serializeConversation, serializeConversationForVisitor, serializeTag };
