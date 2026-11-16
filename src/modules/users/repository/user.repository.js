'use strict';

const User = require('../model/user.model');

/** Fields that must never reach the API surface. */
const PUBLIC_PROJECTION = '_id name email avatar platformRole isActive emailVerifiedAt lastLoginAt createdAt updatedAt';

const create = (data) => User.create(data);

const findById = (id, { lean = true } = {}) => {
  const q = User.findById(id).select(PUBLIC_PROJECTION);
  return lean ? q.lean() : q;
};

const findByIds = (ids) => User.find({ _id: { $in: ids } }).select(PUBLIC_PROJECTION).lean();

const findByEmail = (email) => User.findOne({ email: String(email).toLowerCase() }).select(PUBLIC_PROJECTION).lean();

/** Only for credential verification - explicitly opts the hash back in. */
const findByEmailWithPassword = (email) =>
  User.findOne({ email: String(email).toLowerCase() }).select('+password +tokenVersion').lean();

const findByIdWithPassword = (id) => User.findById(id).select('+password +tokenVersion').lean();

const findAuthContext = (id) =>
  User.findById(id).select('_id name email avatar platformRole isActive emailVerifiedAt +tokenVersion').lean();

const updateById = async (id, update) => {
  const res = await User.updateOne({ _id: id }, update, { runValidators: true });
  if (!res.matchedCount) return null;
  return findById(id);
};

const existsByEmail = async (email) => Boolean(await User.exists({ email: String(email).toLowerCase() }));

const incrementTokenVersion = (id) => User.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } });

async function paginate({ filter = {}, skip = 0, limit = 25, sort = { createdAt: -1 } }) {
  const [items, total] = await Promise.all([
    User.find(filter).select(PUBLIC_PROJECTION).sort(sort).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { items, total };
}

const countDocuments = (filter = {}) => User.countDocuments(filter);

module.exports = {
  PUBLIC_PROJECTION,
  create,
  findById,
  findByIds,
  findByEmail,
  findByEmailWithPassword,
  findByIdWithPassword,
  findAuthContext,
  updateById,
  existsByEmail,
  incrementTokenVersion,
  paginate,
  countDocuments,
};
