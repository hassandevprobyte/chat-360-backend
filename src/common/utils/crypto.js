'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);
const verifyPassword = (plain, hash) => (hash ? bcrypt.compare(plain, hash) : Promise.resolve(false));

/** URL-safe random token, returned raw. Only the SHA-256 digest is persisted. */
function randomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Widget public keys are deliberately prefixed so they are recognisable in logs/support. */
const generatePublicKey = () => `wk_${crypto.randomBytes(24).toString('base64url')}`;

const generateAnonymousId = () => `v_${crypto.randomBytes(16).toString('base64url')}`;

function timingSafeEqual(a = '', b = '') {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  hashPassword,
  verifyPassword,
  randomToken,
  sha256,
  generatePublicKey,
  generateAnonymousId,
  timingSafeEqual,
};
