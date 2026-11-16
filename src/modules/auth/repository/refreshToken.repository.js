'use strict';

const RefreshToken = require('../model/refreshToken.model');

const create = (data) => RefreshToken.create(data);

const findByHash = (tokenHash) => RefreshToken.findOne({ tokenHash }).lean();

const markRotated = (id, replacedByHash) =>
  RefreshToken.updateOne(
    { _id: id, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'rotated', replacedBy: replacedByHash } },
  );

const revokeById = (id, reason = 'logout') =>
  RefreshToken.updateOne({ _id: id, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });

/** Reuse of a rotated token means theft: kill the whole family. */
const revokeFamily = (family, reason = 'reuse_detected') =>
  RefreshToken.updateMany({ family, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });

const revokeAllForUser = (user, reason = 'password_changed') =>
  RefreshToken.updateMany({ user, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });

const listActiveForUser = (user) =>
  RefreshToken.find({ user, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select('_id userAgent clientLabel createdAt expiresAt')
    .sort({ createdAt: -1 })
    .lean();

const deleteExpired = (before = new Date()) =>
  RefreshToken.deleteMany({ $or: [{ expiresAt: { $lt: before } }, { revokedAt: { $lt: new Date(Date.now() - 30 * 86400000) } }] });

module.exports = {
  create,
  findByHash,
  markRotated,
  revokeById,
  revokeFamily,
  revokeAllForUser,
  listActiveForUser,
  deleteExpired,
};
