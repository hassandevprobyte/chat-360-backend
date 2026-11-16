'use strict';

const mongoose = require('mongoose');

/**
 * Refresh sessions. Only the SHA-256 digest of the token is stored, never the
 * raw value. Rotation replaces a record with a child record (same family);
 * reuse of a rotated token revokes the whole family.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    replacedBy: { type: String, default: null },
    userAgent: { type: String, default: null, maxlength: 400 },
    // Coarse client fingerprint for session listing. No raw IP is persisted.
    clientLabel: { type: String, default: null, maxlength: 120 },
  },
  { timestamps: true, versionKey: false },
);

refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
refreshTokenSchema.index({ user: 1, revokedAt: 1 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
