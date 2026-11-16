'use strict';

const Attachment = require('../model/attachment.model');

const create = (data) => Attachment.create(data);

const findOneInWorkspace = (workspace, id) =>
  Attachment.findOne({ _id: id, workspace, deletedAt: null }).lean();

const findByIds = (workspace, ids) =>
  Attachment.find({ workspace, _id: { $in: ids }, deletedAt: null }).lean();

const updateInWorkspace = (workspace, id, update) =>
  Attachment.findOneAndUpdate({ _id: id, workspace, deletedAt: null }, update, { new: true }).lean();

const bindToMessage = (workspace, ids, { conversation, messageId }) =>
  Attachment.updateMany(
    { workspace, _id: { $in: ids } },
    { $set: { conversation, resource: 'MESSAGE', resourceId: messageId } },
  );

const softDelete = (workspace, id) =>
  Attachment.findOneAndUpdate(
    { _id: id, workspace, deletedAt: null },
    { $set: { deletedAt: new Date() } },
    { new: true },
  ).lean();

async function paginate({ filter = {}, skip = 0, limit = 25, sort = { createdAt: -1 } }) {
  const [items, total] = await Promise.all([
    Attachment.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Attachment.countDocuments(filter),
  ]);
  return { items, total };
}

/** Orphaned uploads that were never attached to a message. Used by cleanup. */
const findOrphans = (cutoff, limit = 200) =>
  Attachment.find({ resourceId: null, deletedAt: null, createdAt: { $lt: cutoff } })
    .limit(limit)
    .lean();

const countDocuments = (filter = {}) => Attachment.countDocuments(filter);

module.exports = {
  create,
  findOneInWorkspace,
  findByIds,
  updateInWorkspace,
  bindToMessage,
  softDelete,
  paginate,
  findOrphans,
  countDocuments,
};
