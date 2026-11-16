'use strict';

function serializeNotification(notification) {
  if (!notification) return null;
  return {
    id: String(notification._id || notification.id),
    workspaceId: notification.workspace ? String(notification.workspace) : null,
    type: notification.type,
    title: notification.title,
    message: notification.message || '',
    data: notification.data || {},
    isRead: Boolean(notification.readAt),
    readAt: notification.readAt || null,
    createdAt: notification.createdAt,
  };
}

module.exports = { serializeNotification };
