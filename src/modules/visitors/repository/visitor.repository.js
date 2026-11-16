'use strict';

const Visitor = require('../model/visitor.model');

const findOneInWorkspace = (workspace, id) => Visitor.findOne({ _id: id, workspace }).lean();

const findByAnonymousId = (workspace, anonymousId) => Visitor.findOne({ workspace, anonymousId }).lean();

/**
 * Upsert on { workspace, anonymousId } - the widget may call init on every page
 * load, and the unique index makes this race-safe.
 */
const upsertByAnonymousId = (workspace, anonymousId, { set = {}, setOnInsert = {}, inc = {} }) =>
  Visitor.findOneAndUpdate(
    { workspace, anonymousId },
    {
      $set: set,
      $setOnInsert: { workspace, anonymousId, ...setOnInsert },
      ...(Object.keys(inc).length ? { $inc: inc } : {}),
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).lean();

const updateInWorkspace = (workspace, id, update) =>
  Visitor.findOneAndUpdate({ _id: id, workspace }, update, { new: true, runValidators: true }).lean();

const findByIds = (workspace, ids) => Visitor.find({ workspace, _id: { $in: ids } }).lean();

async function paginate({ filter = {}, skip = 0, limit = 25, sort = { lastSeenAt: -1 } }) {
  const [items, total] = await Promise.all([
    Visitor.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Visitor.countDocuments(filter),
  ]);
  return { items, total };
}

const countDocuments = (filter = {}) => Visitor.countDocuments(filter);

const markStaleOffline = (cutoff) =>
  Visitor.updateMany({ isOnline: true, lastActiveAt: { $lt: cutoff } }, { $set: { isOnline: false } });

module.exports = {
  findOneInWorkspace,
  findByAnonymousId,
  upsertByAnonymousId,
  updateInWorkspace,
  findByIds,
  paginate,
  countDocuments,
  markStaleOffline,
};
