'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../../../config/env');
const { randomToken } = require('../../../common/utils/crypto');
const { toMs, fromNow } = require('../../../common/utils/duration');
const { UnauthorizedError } = require('../../../common/errors');
const { ERROR_CODES } = require('../../../common/constants');
const refreshTokenRepository = require('../repository/refreshToken.repository');

const ISSUER = 'livechat-api';

/**
 * Refresh tokens are opaque random strings; we persist an HMAC of them keyed by
 * JWT_REFRESH_SECRET. A database dump alone therefore cannot be replayed.
 */
const hashRefreshToken = (raw) =>
  crypto.createHmac('sha256', env.jwt.refreshSecret).update(String(raw)).digest('hex');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id || user.id),
      typ: 'access',
      role: user.platformRole,
      tv: user.tokenVersion || 0,
    },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn, issuer: ISSUER },
  );
}

function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret, { issuer: ISSUER });
    if (payload.typ !== 'access') throw new Error('wrong token type');
    return payload;
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw new UnauthorizedError(
      expired ? 'Access token expired' : 'Invalid access token',
      expired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.TOKEN_INVALID,
    );
  }
}

/**
 * Widget/visitor session token. Deliberately a *different* secret and payload
 * shape from dashboard access tokens so an anonymous visitor token can never be
 * mistaken for a user token.
 */
function signVisitorToken({ visitorId, workspaceId, websiteId, widgetId, anonymousId }) {
  return jwt.sign(
    {
      sub: String(visitorId),
      typ: 'visitor',
      ws: String(workspaceId),
      site: String(websiteId),
      wid: String(widgetId),
      aid: anonymousId,
    },
    env.jwt.widgetSecret,
    { expiresIn: env.jwt.widgetExpiresIn, issuer: ISSUER },
  );
}

function verifyVisitorToken(token) {
  try {
    const payload = jwt.verify(token, env.jwt.widgetSecret, { issuer: ISSUER });
    if (payload.typ !== 'visitor') throw new Error('wrong token type');
    return payload;
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw new UnauthorizedError(
      expired ? 'Visitor session expired' : 'Invalid visitor session',
      expired ? ERROR_CODES.TOKEN_EXPIRED : ERROR_CODES.TOKEN_INVALID,
    );
  }
}

async function issueRefreshToken(user, { family, userAgent, clientLabel } = {}) {
  const raw = randomToken(48);
  const record = await refreshTokenRepository.create({
    user: user._id || user.id,
    tokenHash: hashRefreshToken(raw),
    family: family || crypto.randomBytes(16).toString('hex'),
    expiresAt: fromNow(env.jwt.refreshExpiresIn),
    userAgent: userAgent || null,
    clientLabel: clientLabel || null,
  });
  return { token: raw, record };
}

/**
 * Rotation with reuse detection:
 *   valid + active   -> rotate, return new pair
 *   valid + revoked  -> token was already rotated => revoke the family
 *   unknown/expired  -> 401
 */
async function rotateRefreshToken(rawToken, meta = {}) {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await refreshTokenRepository.findByHash(tokenHash);

  if (!existing) throw new UnauthorizedError('Invalid refresh token', ERROR_CODES.TOKEN_INVALID);

  if (existing.revokedAt) {
    await refreshTokenRepository.revokeFamily(existing.family, 'reuse_detected');
    throw new UnauthorizedError('Refresh token reuse detected. Please sign in again.', ERROR_CODES.TOKEN_INVALID);
  }

  if (existing.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError('Refresh token expired', ERROR_CODES.TOKEN_EXPIRED);
  }

  return { existing };
}

async function completeRotation(existing, user, meta = {}) {
  const issued = await issueRefreshToken(user, { ...meta, family: existing.family });
  await refreshTokenRepository.markRotated(existing._id, issued.record.tokenHash);
  return issued;
}

const revokeRefreshToken = async (rawToken, reason = 'logout') => {
  const record = await refreshTokenRepository.findByHash(hashRefreshToken(rawToken));
  if (record) await refreshTokenRepository.revokeById(record._id, reason);
  return Boolean(record);
};

const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'none' : 'lax',
  domain: env.cookies.domain,
  path: '/api/v1/auth',
  maxAge: toMs(env.jwt.refreshExpiresIn),
});

module.exports = {
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
  signVisitorToken,
  verifyVisitorToken,
  issueRefreshToken,
  rotateRefreshToken,
  completeRotation,
  revokeRefreshToken,
  refreshCookieOptions,
  accessTokenTtlSeconds: () => Math.floor(toMs(env.jwt.accessExpiresIn) / 1000),
};
