'use strict';

const WorkspaceMember = require('../model/workspaceMember.model');
const { WORKSPACE_ROLES } = require('../../../common/constants');

const create = (data) => WorkspaceMember.create(data);

/** The single source of truth for "is this user allowed in this workspace". */
const findActiveMembership = (workspace, user) =>
  WorkspaceMember.findOne({ workspace, user, isActive: true }).lean();

const findById = (workspace, id) => WorkspaceMember.findOne({ _id: id, workspace }).lean();

const findByUser = (user) => WorkspaceMember.find({ user, isActive: true }).lean();

const listByWorkspace = (workspace, extra = {}) =>
  WorkspaceMember.find({ workspace, ...extra }).lean();

/** Every member who may handle conversations: OWNER and AGENT alike. */
const listEligibleHandlers = (workspace) =>
  WorkspaceMember.find({
    workspace,
    isActive: true,
    role: { $in: [WORKSPACE_ROLES.OWNER, WORKSPACE_ROLES.AGENT] },
  })
    .select('user role')
    .lean();

const countOwners = (workspace) =>
  WorkspaceMember.countDocuments({ workspace, role: WORKSPACE_ROLES.OWNER, isActive: true });

const updateById = (workspace, id, update) =>
  WorkspaceMember.findOneAndUpdate({ _id: id, workspace }, update, { new: true, runValidators: true }).lean();

const removeById = (workspace, id) => WorkspaceMember.findOneAndDelete({ _id: id, workspace }).lean();

const upsertMembership = (workspace, user, update) =>
  WorkspaceMember.findOneAndUpdate(
    { workspace, user },
    { $set: update, $setOnInsert: { workspace, user, joinedAt: new Date() } },
    { new: true, upsert: true, runValidators: true },
  ).lean();

async function paginate({ filter = {}, skip = 0, limit = 25, sort = { createdAt: -1 } }) {
  const [items, total] = await Promise.all([
    WorkspaceMember.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    WorkspaceMember.countDocuments(filter),
  ]);
  return { items, total };
}

const countDocuments = (filter = {}) => WorkspaceMember.countDocuments(filter);

module.exports = {
  create,
  findActiveMembership,
  findById,
  findByUser,
  listByWorkspace,
  listEligibleHandlers,
  countOwners,
  updateById,
  removeById,
  upsertMembership,
  paginate,
  countDocuments,
};
