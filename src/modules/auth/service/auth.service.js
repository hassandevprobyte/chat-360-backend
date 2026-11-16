'use strict';

const env = require('../../../config/env');
const logger = require('../../../common/logger');
const {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} = require('../../../common/errors');
const { ERROR_CODES, PLATFORM_ROLES } = require('../../../common/constants');
const { hashPassword, verifyPassword, randomToken, sha256 } = require('../../../common/utils/crypto');
const { fromNow } = require('../../../common/utils/duration');
const { parseUserAgent } = require('../../../common/utils/userAgent');
const userRepository = require('../../users/repository/user.repository');
const memberRepository = require('../../workspaces/repository/workspaceMember.repository');
const { serializeUser } = require('../../users/serializer');
const emailService = require('../../../services/email/email.service');
const tokenService = require('./token.service');
const refreshTokenRepository = require('../repository/refreshToken.repository');
const authTokenRepository = require('../repository/authToken.repository');
const { AUTH_TOKEN_TYPES } = require('../model/authToken.model');

const clientMeta = (req) => {
  const ua = parseUserAgent(req.get('user-agent'));
  return {
    userAgent: ua.userAgent || null,
    clientLabel: `${ua.browser} on ${ua.operatingSystem}`,
  };
};

async function issueSession(user, req) {
  const accessToken = tokenService.signAccessToken(user);
  const { token: refreshToken } = await tokenService.issueRefreshToken(user, clientMeta(req));
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: tokenService.accessTokenTtlSeconds(),
  };
}

/** Workspaces the user can act in - the dashboard needs this right after login. */
async function loadMemberships(userId) {
  const memberships = await memberRepository.findByUser(userId);
  if (!memberships.length) return [];
  // eslint-disable-next-line global-require
  const workspaceRepository = require('../../workspaces/repository/workspace.repository');
  const workspaces = await workspaceRepository.findByIds(memberships.map((m) => m.workspace));
  const byId = new Map(workspaces.map((w) => [String(w._id), w]));
  return memberships
    .map((m) => {
      const workspace = byId.get(String(m.workspace));
      if (!workspace || !workspace.isActive) return null;
      return {
        id: String(workspace._id),
        name: workspace.name,
        slug: workspace.slug,
        role: m.role,
        isOwner: String(workspace.owner) === String(userId),
      };
    })
    .filter(Boolean);
}

async function createEmailToken(user, type, expiresIn) {
  const raw = randomToken(32);
  await authTokenRepository.invalidateAllOfType(user._id, type);
  await authTokenRepository.create({
    user: user._id,
    type,
    tokenHash: sha256(raw),
    expiresAt: fromNow(expiresIn),
  });
  return raw;
}

/* ------------------------------------------------------------------ */

async function register({ name, email, password }, req) {
  if (await userRepository.existsByEmail(email)) {
    // Registration is a public endpoint, but the email is one the caller just
    // typed - a clear conflict beats a silent success here.
    throw new ConflictError('An account with this email already exists', ERROR_CODES.ALREADY_EXISTS);
  }

  const user = await userRepository.create({
    name,
    email,
    password: await hashPassword(password),
    platformRole: PLATFORM_ROLES.USER,
  });

  const token = await createEmailToken(user, AUTH_TOKEN_TYPES.EMAIL_VERIFICATION, env.tokens.emailVerificationExpiresIn);
  await emailService.sendVerificationEmail({ user, token });

  const session = await issueSession(user, req);
  return { user: serializeUser(user), workspaces: [], ...session };
}

async function login({ email, password }, req) {
  const user = await userRepository.findByEmailWithPassword(email);
  const valid = await verifyPassword(password, user ? user.password : null);

  // Identical response for unknown email and wrong password.
  if (!user || !valid) {
    logger.warn({ email }, 'Failed login attempt');
    throw new UnauthorizedError('Invalid email or password', ERROR_CODES.INVALID_CREDENTIALS);
  }
  if (!user.isActive) throw new ForbiddenError('Account is deactivated', ERROR_CODES.ACCOUNT_INACTIVE);

  await userRepository.updateById(user._id, { $set: { lastLoginAt: new Date() } });

  const session = await issueSession(user, req);
  return {
    user: serializeUser({ ...user, lastLoginAt: new Date() }),
    workspaces: await loadMemberships(user._id),
    ...session,
  };
}

async function refresh(rawToken, req) {
  if (!rawToken) throw new UnauthorizedError('Refresh token is required', ERROR_CODES.TOKEN_INVALID);

  const { existing } = await tokenService.rotateRefreshToken(rawToken);
  const user = await userRepository.findByIdWithPassword(existing.user);

  if (!user || !user.isActive) {
    await refreshTokenRepository.revokeFamily(existing.family, 'user_inactive');
    throw new UnauthorizedError('Session is no longer valid', ERROR_CODES.TOKEN_INVALID);
  }

  const issued = await tokenService.completeRotation(existing, user, clientMeta(req));
  return {
    accessToken: tokenService.signAccessToken(user),
    refreshToken: issued.token,
    tokenType: 'Bearer',
    expiresIn: tokenService.accessTokenTtlSeconds(),
  };
}

async function logout(rawToken, userId, { allDevices = false } = {}) {
  if (allDevices && userId) {
    await refreshTokenRepository.revokeAllForUser(userId, 'logout_all');
    return { revoked: 'all' };
  }
  if (rawToken) await tokenService.revokeRefreshToken(rawToken, 'logout');
  return { revoked: rawToken ? 'session' : 'none' };
}

async function verifyEmail(rawToken) {
  const record = await authTokenRepository.findUsable(sha256(rawToken), AUTH_TOKEN_TYPES.EMAIL_VERIFICATION);
  if (!record) throw new BadRequestError('This verification link is invalid or has expired', ERROR_CODES.TOKEN_INVALID);

  const consumed = await authTokenRepository.consume(record._id);
  if (!consumed) throw new BadRequestError('This verification link has already been used', ERROR_CODES.TOKEN_INVALID);

  const user = await userRepository.updateById(record.user, { $set: { emailVerifiedAt: new Date() } });
  if (!user) throw new NotFoundError('Account not found');
  return { user: serializeUser(user) };
}

async function resendVerification(userId) {
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError('Account not found');
  if (user.emailVerifiedAt) return { sent: false, reason: 'already_verified' };

  const token = await createEmailToken(user, AUTH_TOKEN_TYPES.EMAIL_VERIFICATION, env.tokens.emailVerificationExpiresIn);
  await emailService.sendVerificationEmail({ user, token });
  return { sent: true };
}

/** Always reports success: this endpoint must not confirm whether an email exists. */
async function forgotPassword(email) {
  const user = await userRepository.findByEmail(email);
  if (user && user.isActive) {
    const token = await createEmailToken(user, AUTH_TOKEN_TYPES.PASSWORD_RESET, env.tokens.passwordResetExpiresIn);
    await emailService.sendPasswordResetEmail({ user, token });
  } else {
    logger.info({ email }, 'Password reset requested for unknown or inactive account');
  }
  return { message: 'If an account exists for that email, a reset link has been sent.' };
}

async function resetPassword({ token, password }) {
  const record = await authTokenRepository.findUsable(sha256(token), AUTH_TOKEN_TYPES.PASSWORD_RESET);
  if (!record) throw new BadRequestError('This reset link is invalid or has expired', ERROR_CODES.TOKEN_INVALID);

  const consumed = await authTokenRepository.consume(record._id);
  if (!consumed) throw new BadRequestError('This reset link has already been used', ERROR_CODES.TOKEN_INVALID);

  await userRepository.updateById(record.user, { $set: { password: await hashPassword(password) } });
  // A password change invalidates every existing session, everywhere.
  await Promise.all([
    refreshTokenRepository.revokeAllForUser(record.user, 'password_reset'),
    userRepository.incrementTokenVersion(record.user),
  ]);

  return { message: 'Password updated. Please sign in with your new password.' };
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await userRepository.findByIdWithPassword(userId);
  if (!user) throw new NotFoundError('Account not found');

  if (!(await verifyPassword(currentPassword, user.password))) {
    throw new UnauthorizedError('Current password is incorrect', ERROR_CODES.INVALID_CREDENTIALS);
  }
  if (await verifyPassword(newPassword, user.password)) {
    throw new BadRequestError('New password must be different from the current password');
  }

  await userRepository.updateById(userId, { $set: { password: await hashPassword(newPassword) } });
  await Promise.all([
    refreshTokenRepository.revokeAllForUser(userId, 'password_changed'),
    userRepository.incrementTokenVersion(userId),
  ]);

  return { message: 'Password changed. Other sessions have been signed out.' };
}

const listSessions = async (userId) => {
  const sessions = await refreshTokenRepository.listActiveForUser(userId);
  return sessions.map((s) => ({
    id: String(s._id),
    client: s.clientLabel || 'Unknown device',
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }));
};

const revokeSession = async (userId, sessionId) => {
  const sessions = await refreshTokenRepository.listActiveForUser(userId);
  const target = sessions.find((s) => String(s._id) === String(sessionId));
  if (!target) throw new NotFoundError('Session not found');
  await refreshTokenRepository.revokeById(target._id, 'revoked_by_user');
  return { revoked: true };
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  listSessions,
  revokeSession,
  loadMemberships,
};
