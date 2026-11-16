'use strict';

const Widget = require('../model/widget.model');

const create = (data) => Widget.create(data);

const findOneInWorkspace = (workspace, id) =>
  Widget.findOne({ _id: id, workspace, deletedAt: null }).lean();

/**
 * The only lookup that is not workspace-scoped: the public key *is* the tenant
 * identifier for the widget API. Everything derived from the result (workspace,
 * website) is then treated as server-side truth.
 */
const findByPublicKey = (publicKey) => Widget.findOne({ publicKey, deletedAt: null }).lean();

const updateInWorkspace = (workspace, id, update) =>
  Widget.findOneAndUpdate({ _id: id, workspace, deletedAt: null }, update, {
    new: true,
    runValidators: true,
  }).lean();

const softDelete = (workspace, id) =>
  Widget.findOneAndUpdate(
    { _id: id, workspace, deletedAt: null },
    { $set: { deletedAt: new Date(), isActive: false } },
    { new: true },
  ).lean();

const deactivateForWebsite = (workspace, website) =>
  Widget.updateMany({ workspace, website, deletedAt: null }, { $set: { isActive: false } });

const listPublicKeysForWebsite = async (workspace, website) => {
  const rows = await Widget.find({ workspace, website }).select('publicKey').lean();
  return rows.map((r) => r.publicKey);
};

async function paginate({ filter = {}, skip = 0, limit = 25, sort = { createdAt: -1 } }) {
  const [items, total] = await Promise.all([
    Widget.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    Widget.countDocuments(filter),
  ]);
  return { items, total };
}

const countDocuments = (filter = {}) => Widget.countDocuments(filter);

module.exports = {
  create,
  findOneInWorkspace,
  findByPublicKey,
  updateInWorkspace,
  softDelete,
  deactivateForWebsite,
  listPublicKeysForWebsite,
  paginate,
  countDocuments,
};
