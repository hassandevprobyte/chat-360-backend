'use strict';

const { NotFoundError } = require('../../../common/errors');
const { cleanText } = require('../../../common/utils/sanitize');
const userRepository = require('../repository/user.repository');
const { serializeUser } = require('../serializer');
const authService = require('../../auth/service/auth.service');

async function getCurrentUser(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError('Account not found');
  return {
    user: serializeUser(user),
    workspaces: await authService.loadMemberships(userId),
  };
}

/**
 * Only profile fields are writable here. platformRole, isActive and
 * emailVerifiedAt are never accepted from the client.
 */
async function updateProfile(userId, payload) {
  const update = {};
  if (payload.name !== undefined) update.name = cleanText(payload.name, { maxLength: 120 });
  if (payload.avatar !== undefined) update.avatar = payload.avatar || null;

  const user = await userRepository.updateById(userId, { $set: update });
  if (!user) throw new NotFoundError('Account not found');
  return serializeUser(user);
}

module.exports = { getCurrentUser, updateProfile };
