'use strict';

const Tag = require('../model/tag.model');

const create = (data) => Tag.create(data);

const findOneInWorkspace = (workspace, id) => Tag.findOne({ _id: id, workspace }).lean();

/** Uniqueness inside a workspace is enforced on the lowercased name. */
const findByNameKey = (workspace, nameKey) => Tag.findOne({ workspace, nameKey }).lean();

const findByIds = (workspace, ids) =>
  Tag.find({ workspace, _id: { $in: ids } }).select('_id name color isActive').lean();

/** Returns only ids that really belong to the workspace and are usable. */
const findActiveByIds = (workspace, ids) =>
  Tag.find({ workspace, _id: { $in: ids }, isActive: true }).select('_id name color').lean();

const updateInWorkspace = (workspace, id, update) =>
  Tag.findOneAndUpdate({ _id: id, workspace }, update, { new: true, runValidators: true }).lean();

const deleteInWorkspace = (workspace, id) => Tag.findOneAndDelete({ _id: id, workspace }).lean();

async function paginate({ filter = {}, skip = 0, limit = 25, sort = { name: 1 } }) {
  const [items, total] = await Promise.all([
    Tag.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Tag.countDocuments(filter),
  ]);
  return { items, total };
}

const countDocuments = (filter = {}) => Tag.countDocuments(filter);

module.exports = {
  create,
  findOneInWorkspace,
  findByNameKey,
  findByIds,
  findActiveByIds,
  updateInWorkspace,
  deleteInWorkspace,
  paginate,
  countDocuments,
};
