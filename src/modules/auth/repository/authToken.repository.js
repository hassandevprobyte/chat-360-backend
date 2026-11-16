'use strict';

const AuthToken = require('../model/authToken.model');

const create = (data) => AuthToken.create(data);

const findUsable = (tokenHash, type) =>
  AuthToken.findOne({ tokenHash, type, usedAt: null, expiresAt: { $gt: new Date() } }).lean();

/** Atomic single-use consumption - a replayed token finds nothing. */
const consume = (id) =>
  AuthToken.findOneAndUpdate({ _id: id, usedAt: null }, { $set: { usedAt: new Date() } }, { new: true }).lean();

const invalidateAllOfType = (user, type) =>
  AuthToken.updateMany({ user, type, usedAt: null }, { $set: { usedAt: new Date() } });

const deleteExpired = (before = new Date()) => AuthToken.deleteMany({ expiresAt: { $lt: before } });

module.exports = { create, findUsable, consume, invalidateAllOfType, deleteExpired };
