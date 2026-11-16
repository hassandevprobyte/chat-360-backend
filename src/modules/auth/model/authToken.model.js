'use strict';

const mongoose = require('mongoose');

const AUTH_TOKEN_TYPES = Object.freeze({
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
});

/** Single-use, hashed, TTL-expiring tokens for email flows. */
const authTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(AUTH_TOKEN_TYPES), required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

authTokenSchema.index({ tokenHash: 1, type: 1 }, { unique: true });
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AuthToken = mongoose.model('AuthToken', authTokenSchema);
AuthToken.TYPES = AUTH_TOKEN_TYPES;

module.exports = AuthToken;
module.exports.AUTH_TOKEN_TYPES = AUTH_TOKEN_TYPES;
