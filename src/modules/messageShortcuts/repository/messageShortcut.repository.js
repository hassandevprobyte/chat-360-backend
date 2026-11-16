'use strict';

const MessageShortcut = require('../model/messageShortcut.model');

const create = (data) => MessageShortcut.create(data);

/**
 * Every read is scoped by BOTH workspace and user.
 *
 * Shortcuts are personal, so `{ workspace, user }` is the isolation boundary:
 * another agent in the same workspace cannot read or mutate these records.
 */
const findOneForUser = (workspace, user, id) =>
  MessageShortcut.findOne({ _id: id, workspace, user }).lean();

const findByShortcut = (workspace, user, shortcut) =>
  MessageShortcut.findOne({ workspace, user, shortcut }).lean();

/** Composer suggestion list: small, sorted, and projected to what the UI needs. */
const listForUser = (workspace, user, { activeOnly = true, limit = 200 } = {}) =>
  MessageShortcut.find({ workspace, user, ...(activeOnly ? { isActive: true } : {}) })
    .select('_id shortcut content isActive usageCount lastUsedAt updatedAt')
    .sort({ shortcut: 1 })
    .limit(limit)
    .lean();

const updateForUser = (workspace, user, id, update) =>
  MessageShortcut.findOneAndUpdate({ _id: id, workspace, user }, update, {
    new: true,
    runValidators: true,
  }).lean();

const deleteForUser = (workspace, user, id) =>
  MessageShortcut.findOneAndDelete({ _id: id, workspace, user }).lean();

const incrementUsage = (workspace, user, id) =>
  MessageShortcut.updateOne(
    { _id: id, workspace, user },
    { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } },
  );

async function paginate({ filter = {}, skip = 0, limit = 25, sort = { shortcut: 1 } }) {
  const [items, total] = await Promise.all([
    MessageShortcut.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    MessageShortcut.countDocuments(filter),
  ]);
  return { items, total };
}

const countDocuments = (filter = {}) => MessageShortcut.countDocuments(filter);

const insertMany = (docs) => MessageShortcut.insertMany(docs, { ordered: false });

module.exports = {
  create,
  findOneForUser,
  findByShortcut,
  listForUser,
  updateForUser,
  deleteForUser,
  incrementUsage,
  paginate,
  countDocuments,
  insertMany,
};
