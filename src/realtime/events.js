'use strict';

/** Canonical realtime event names. Shared by the API, the workers and both frontends. */
const EVENTS = Object.freeze({
  CONVERSATION_CREATED: 'conversation.created',
  CONVERSATION_UPDATED: 'conversation.updated',
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_CLOSED: 'conversation.closed',
  CONVERSATION_REOPENED: 'conversation.reopened',

  MESSAGE_CREATED: 'message.created',
  MESSAGE_UPDATED: 'message.updated',
  MESSAGE_READ: 'message.read',

  TYPING_START: 'typing.start',
  TYPING_STOP: 'typing.stop',

  VISITOR_ONLINE: 'visitor.online',
  VISITOR_OFFLINE: 'visitor.offline',
  VISITOR_UPDATED: 'visitor.updated',

  AGENT_ONLINE: 'agent.online',
  AGENT_AWAY: 'agent.away',
  AGENT_OFFLINE: 'agent.offline',

  NOTIFICATION_CREATED: 'notification.created',
  WIDGET_CONFIG_UPDATED: 'widget.config_updated',
});

/**
 * Room naming.
 *
 * - workspace:{id}    agents/owners only. Carries inbox-level events, including
 *                     INTERNAL_NOTE messages. Visitors can never join it.
 * - conversation:{id} agents currently viewing a thread (typing / read receipts).
 * - visitor:{id}      one visitor's own sockets. Only visitor-safe payloads.
 * - user:{id}         one dashboard user's sockets across devices (notifications).
 */
const ROOMS = Object.freeze({
  workspace: (workspaceId) => `workspace:${workspaceId}`,
  conversation: (conversationId) => `conversation:${conversationId}`,
  visitor: (visitorId) => `visitor:${visitorId}`,
  user: (userId) => `user:${userId}`,
});

const SOCKET_TYPES = Object.freeze({ DASHBOARD: 'dashboard', WIDGET: 'widget' });

module.exports = { EVENTS, ROOMS, SOCKET_TYPES };
