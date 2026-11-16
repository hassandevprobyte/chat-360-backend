'use strict';

const Invitation = require('../model/invitation.model');
const { INVITATION_STATUS } = require('../../../common/constants');

const create = (data) => Invitation.create(data);

const findPendingByHash = (tokenHash) =>
  Invitation.findOne({ tokenHash, status: INVITATION_STATUS.PENDING, expiresAt: { $gt: new Date() } }).lean();

const findPendingByEmail = (workspace, email) =>
  Invitation.findOne({ workspace, email: String(email).toLowerCase(), status: INVITATION_STATUS.PENDING }).lean();

const accept = (id, userId) =>
  Invitation.findOneAndUpdate(
    { _id: id, status: INVITATION_STATUS.PENDING },
    { $set: { status: INVITATION_STATUS.ACCEPTED, acceptedAt: new Date(), acceptedBy: userId } },
    { new: true },
  ).lean();

const revoke = (workspace, id) =>
  Invitation.findOneAndUpdate(
    { _id: id, workspace, status: INVITATION_STATUS.PENDING },
    { $set: { status: INVITATION_STATUS.REVOKED } },
    { new: true },
  ).lean();

const expireStale = () =>
  Invitation.updateMany(
    { status: INVITATION_STATUS.PENDING, expiresAt: { $lte: new Date() } },
    { $set: { status: INVITATION_STATUS.EXPIRED } },
  );

async function paginate({ filter = {}, skip = 0, limit = 25 }) {
  const [items, total] = await Promise.all([
    Invitation.find(filter).select('-tokenHash').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invitation.countDocuments(filter),
  ]);
  return { items, total };
}

module.exports = { create, findPendingByHash, findPendingByEmail, accept, revoke, expireStale, paginate };
