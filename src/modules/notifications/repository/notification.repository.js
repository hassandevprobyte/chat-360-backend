'use strict';

const Notification = require('../model/notification.model');

const create = (data) => Notification.create(data);

const insertMany = (docs) => Notification.insertMany(docs, { ordered: false });

/** Cursor pagination: notification feeds only ever grow. */
const findPage = (filter, limit) =>
  Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();

const countUnread = (user, workspace) =>
  Notification.countDocuments({ user, readAt: null, ...(workspace ? { workspace } : {}) });

/** Scoped by user so one user can never mark another's notification read. */
const markOneRead = (user, id) =>
  Notification.findOneAndUpdate(
    { _id: id, user, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true },
  ).lean();

const markAllRead = (user, workspace) =>
  Notification.updateMany(
    { user, readAt: null, ...(workspace ? { workspace } : {}) },
    { $set: { readAt: new Date() } },
  );

const findOneForUser = (user, id) => Notification.findOne({ _id: id, user }).lean();

const deleteOlderThan = (date) => Notification.deleteMany({ createdAt: { $lt: date }, readAt: { $ne: null } });

module.exports = {
  create,
  insertMany,
  findPage,
  countUnread,
  markOneRead,
  markAllRead,
  findOneForUser,
  deleteOlderThan,
};
