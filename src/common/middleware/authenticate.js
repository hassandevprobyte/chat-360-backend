'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { UnauthorizedError, ForbiddenError } = require('../errors');
const { ERROR_CODES, PLATFORM_ROLES } = require('../constants');
const tokenService = require('../../modules/auth/service/token.service');
const userRepository = require('../../modules/users/repository/user.repository');

function readBearer(req) {
  const header = req.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Verifies the access token and loads a fresh user record.
 *
 * The DB read is deliberate: it lets deactivation, email changes and token
 * version bumps take effect immediately instead of at token expiry.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const token = readBearer(req);
  if (!token) throw new UnauthorizedError('Authentication required');

  const payload = tokenService.verifyAccessToken(token);
  const user = await userRepository.findAuthContext(payload.sub);

  if (!user) throw new UnauthorizedError('Account no longer exists', ERROR_CODES.TOKEN_INVALID);
  if (!user.isActive) throw new ForbiddenError('Account is deactivated', ERROR_CODES.ACCOUNT_INACTIVE);
  if ((user.tokenVersion || 0) !== (payload.tv || 0)) {
    throw new UnauthorizedError('Session is no longer valid', ERROR_CODES.TOKEN_INVALID);
  }

  req.user = {
    id: String(user._id),
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    platformRole: user.platformRole,
    emailVerifiedAt: user.emailVerifiedAt,
    isSuperAdmin: user.platformRole === PLATFORM_ROLES.SUPER_ADMIN,
  };
  return next();
});

/** Attaches req.user when a token is present, but never rejects. */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  if (!readBearer(req)) return next();
  try {
    return await authenticate(req, res, next);
  } catch (err) {
    return next();
  }
});

module.exports = { authenticate, optionalAuthenticate, readBearer };
