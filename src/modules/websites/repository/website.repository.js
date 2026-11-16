'use strict';

const Website = require('../model/website.model');

/**
 * Every read is workspace-scoped. There is deliberately no `findById(id)` here:
 * the only way to load a website is with its tenant, which makes IDOR
 * impossible by construction.
 */
const create = (data) => Website.create(data);

const findOneInWorkspace = (workspace, id) =>
  Website.findOne({ _id: id, workspace, deletedAt: null }).lean();

/** Same lookup, but with the normally-hidden verificationToken included. */
const findOneInWorkspaceWithToken = (workspace, id) =>
  Website.findOne({ _id: id, workspace, deletedAt: null }).select('+verificationToken').lean();

const findByDomain = (workspace, domain) =>
  Website.findOne({ workspace, domain, deletedAt: null }).lean();

const updateInWorkspace = (workspace, id, update) =>
  Website.findOneAndUpdate({ _id: id, workspace, deletedAt: null }, update, {
    new: true,
    runValidators: true,
  }).lean();

const softDelete = (workspace, id) =>
  Website.findOneAndUpdate(
    { _id: id, workspace, deletedAt: null },
    { $set: { deletedAt: new Date(), status: 'INACTIVE' } },
    { new: true },
  ).lean();

async function paginate({ filter = {}, skip = 0, limit = 25, sort = { createdAt: -1 } }) {
  const [items, total] = await Promise.all([
    Website.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Website.countDocuments(filter),
  ]);
  return { items, total };
}

const listAllInWorkspace = (workspace) =>
  Website.find({ workspace, deletedAt: null }).select('_id name domain status').lean();

const countDocuments = (filter = {}) => Website.countDocuments(filter);

module.exports = {
  create,
  findOneInWorkspace,
  findOneInWorkspaceWithToken,
  findByDomain,
  updateInWorkspace,
  softDelete,
  paginate,
  listAllInWorkspace,
  countDocuments,
};
