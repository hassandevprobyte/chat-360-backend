'use strict';

const mongoose = require('mongoose');
const { PLATFORM_ROLES } = require('../../../common/constants');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    // `select: false` so no query can leak the hash by accident.
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: null, maxlength: 512 },
    platformRole: {
      type: String,
      enum: Object.values(PLATFORM_ROLES),
      default: PLATFORM_ROLES.USER,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    emailVerifiedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    // Bumping this invalidates every previously issued access token.
    tokenVersion: { type: Number, default: 0, select: false },
  },
  { timestamps: true, versionKey: false },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
