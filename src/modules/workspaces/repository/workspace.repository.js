'use strict';

const Workspace = require('../model/workspace.model');

const create = (data) => Workspace.create(data);

const findById = (id) => Workspace.findById(id).lean();

const findActiveById = (id) => Workspace.findOne({ _id: id, isActive: true }).lean();

const findBySlug = (slug) => Workspace.findOne({ slug }).lean();

const slugExists = async (slug) => Boolean(await Workspace.exists({ slug }));

const updateById = (id, update) =>
  Workspace.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();

const findByIds = (ids) => Workspace.find({ _id: { $in: ids } }).lean();

async function paginate({ filter = {}, skip = 0, limit = 25, sort = { createdAt: -1 } }) {
  const [items, total] = await Promise.all([
    Workspace.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Workspace.countDocuments(filter),
  ]);
  return { items, total };
}

const countDocuments = (filter = {}) => Workspace.countDocuments(filter);

module.exports = {
  create,
  findById,
  findActiveById,
  findBySlug,
  slugExists,
  updateById,
  findByIds,
  paginate,
  countDocuments,
};
