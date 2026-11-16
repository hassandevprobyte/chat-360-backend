'use strict';

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const env = require('../../config/env');
const { getRedis, key, isRedisDisabled } = require('../../config/redis');
const { failure } = require('../response');
const { ERROR_CODES } = require('../constants');
const logger = require('../logger');

/**
 * Redis-backed so limits are shared across API instances. Falls back to the
 * in-process store when Redis is intentionally disabled (tests).
 */
function buildStore(prefix) {
  if (isRedisDisabled()) return undefined;
  const client = getRedis();
  return new RedisStore({
    prefix: `${key('rl', prefix)}:`,
    sendCommand: (...args) => client.call(...args),
  });
}

const handler = (req, res) =>
  failure(res, { status: 429, code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests. Please slow down.' });

function createLimiter({ windowMs, max, prefix, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore(prefix),
    keyGenerator,
    handler,
    skip: () => env.isTest,
  });
}

/** Broad protection for the authenticated dashboard API. */
const apiLimiter = createLimiter({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  prefix: 'api',
  keyGenerator: (req) => (req.user ? `u:${req.user.id}` : `ip:${req.ip}`),
});

/** Tight limit on credential endpoints, keyed by IP + email to blunt spraying. */
const authLimiter = createLimiter({
  windowMs: env.rateLimit.authWindowMs,
  max: env.rateLimit.authMax,
  prefix: 'auth',
  keyGenerator: (req) => {
    const email = req.body && req.body.email ? String(req.body.email).toLowerCase() : 'anon';
    return `${req.ip}:${email}`;
  },
});

/** Public widget endpoints are keyed by visitor/widget rather than user. */
const publicLimiter = createLimiter({
  windowMs: env.rateLimit.publicWindowMs,
  max: env.rateLimit.publicMax,
  prefix: 'public',
  keyGenerator: (req) => {
    if (req.visitor) return `v:${req.visitor.id}`;
    if (req.params && req.params.publicKey) return `w:${req.params.publicKey}:${req.ip}`;
    return `ip:${req.ip}`;
  },
});

/** Visitor message sending: prevents a scripted page from flooding a queue. */
const visitorMessageLimiter = createLimiter({
  windowMs: 60000,
  max: 40,
  prefix: 'visitor-msg',
  keyGenerator: (req) => (req.visitor ? `v:${req.visitor.id}` : `ip:${req.ip}`),
});

const uploadLimiter = createLimiter({
  windowMs: 60000,
  max: 20,
  prefix: 'upload',
  keyGenerator: (req) => (req.user ? `u:${req.user.id}` : req.visitor ? `v:${req.visitor.id}` : `ip:${req.ip}`),
});

if (isRedisDisabled()) logger.warn('Rate limiting is using the in-memory store (REDIS_DISABLED=true)');

module.exports = { apiLimiter, authLimiter, publicLimiter, visitorMessageLimiter, uploadLimiter, createLimiter };
