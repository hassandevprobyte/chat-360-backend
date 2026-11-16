'use strict';

const { NOTIFICATION_TYPES, QUEUE_NAMES, JOB_NAMES } = require('../../../common/constants');
const { parseCursorQuery, cursorFilter, cursorMeta } = require('../../../common/utils/pagination');
const { requireObjectId } = require('../../../common/utils/objectId');
const { NotFoundError } = require('../../../common/errors');
const logger = require('../../../common/logger');
const { enqueue } = require('../../../jobs/queues');
const emitter = require('../../../realtime/emitter');
const notificationRepository = require('../repository/notification.repository');
const { serializeNotification } = require('../serializer');

/**
 * Creates in-app notifications and pushes them over Socket.IO immediately.
 *
 * Email fan-out is handed to the notifications queue: the recipient sees the
 * in-app notification instantly, while slower channels happen out of band.
 */
async function notify({ users, workspace = null, type, title, message = '', data = {}, email = null }) {
  const recipients = [...new Set([].concat(users).filter(Boolean).map(String))];
  if (!recipients.length) return [];

  const docs = recipients.map((user) => ({ user, workspace, type, title, message, data }));
  let created = [];
  try {
    created = await notificationRepository.insertMany(docs);
  } catch (err) {
    logger.error({ err, type }, 'Failed to persist notifications');
    return [];
  }

  created.forEach((notification) => {
    emitter.toUser(notification.user, emitter.EVENTS.NOTIFICATION_CREATED, serializeNotification(notification));
  });

  if (email) {
    await enqueue(QUEUE_NAMES.NOTIFICATIONS, JOB_NAMES.DISPATCH_NOTIFICATION, {
      userIds: recipients,
      workspaceId: workspace ? String(workspace) : null,
      email,
    });
  }

  return created.map(serializeNotification);
}

async function list(userId, query = {}) {
  const { limit, cursor, direction } = parseCursorQuery(query);
  const filter = { user: userId, ...cursorFilter(cursor, { direction }) };
  if (query.workspaceId) filter.workspace = requireObjectId(query.workspaceId, 'Workspace');
  if (query.unreadOnly) filter.readAt = null;
  if (query.type) filter.type = query.type;

  const rows = await notificationRepository.findPage(filter, limit);
  const { items, meta } = cursorMeta({ items: rows, limit, direction });
  return { data: items.map(serializeNotification), meta };
}

const unreadCount = async (userId, workspaceId) => ({
  unread: await notificationRepository.countUnread(
    userId,
    workspaceId ? requireObjectId(workspaceId, 'Workspace') : null,
  ),
});

async function markRead(userId, notificationId) {
  const id = requireObjectId(notificationId, 'Notification');
  const updated = await notificationRepository.markOneRead(userId, id);
  if (updated) return serializeNotification(updated);

  // Either it does not exist, belongs to someone else, or was already read.
  const existing = await notificationRepository.findOneForUser(userId, id);
  if (!existing) throw new NotFoundError('Notification not found');
  return serializeNotification(existing);
}

async function markAllRead(userId, workspaceId) {
  const result = await notificationRepository.markAllRead(
    userId,
    workspaceId ? requireObjectId(workspaceId, 'Workspace') : null,
  );
  return { updated: result.modifiedCount || 0 };
}

module.exports = { NOTIFICATION_TYPES, notify, list, unreadCount, markRead, markAllRead };
