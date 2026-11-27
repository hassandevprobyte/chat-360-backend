const EVENTS = Object.freeze({
  CONVERSATION_CREATED: "conversation.created",
  CONVERSATION_UPDATED: "conversation.updated",
  CONVERSATION_ASSIGNED: "conversation.assigned",
  CONVERSATION_CLOSED: "conversation.closed",
  CONVERSATION_REOPENED: "conversation.reopened",

  MESSAGE_CREATED: "message.created",
  MESSAGE_UPDATED: "message.updated",
  MESSAGE_READ: "message.read",

  TYPING_START: "typing.start",
  TYPING_STOP: "typing.stop",

  VISITOR_ONLINE: "visitor.online",
  VISITOR_OFFLINE: "visitor.offline",
  VISITOR_UPDATED: "visitor.updated",

  AGENT_ONLINE: "agent.online",
  AGENT_AWAY: "agent.away",
  AGENT_OFFLINE: "agent.offline",

  NOTIFICATION_CREATED: "notification.created",
  WIDGET_CONFIG_UPDATED: "widget.config_updated",
});

const ROOMS = Object.freeze({
  workspace: (workspaceId) => `workspace:${workspaceId}`,
  conversation: (conversationId) => `conversation:${conversationId}`,
  visitor: (visitorId) => `visitor:${visitorId}`,
  user: (userId) => `user:${userId}`,
});

module.exports = { EVENTS, ROOMS };
