'use strict';

const mongoose = require('mongoose');
const { WEBSITE_STATUS, VERIFICATION_STATUS, VERIFICATION_METHODS } = require('../../../common/constants');

const websiteSettingsSchema = new mongoose.Schema(
  {
    // Reject widget traffic whose Origin is not in domain/allowedDomains.
    enforceOriginCheck: { type: Boolean, default: true },
    collectVisitorLocation: { type: Boolean, default: false },
  },
  { _id: false },
);

const websiteSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    domain: { type: String, required: true, lowercase: true, trim: true, maxlength: 253 },
    // Extra origins (staging, www variants, `*.example.com`).
    allowedDomains: { type: [String], default: [] },
    status: { type: String, enum: Object.values(WEBSITE_STATUS), default: WEBSITE_STATUS.ACTIVE },
    settings: { type: websiteSettingsSchema, default: () => ({}) },
    // Domain ownership verification: DNS TXT record, homepage <meta> tag, or a
    // well-known file the owner uploads. The token is the single shared secret
    // behind all three methods, so it is never returned by default queries.
    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.UNVERIFIED,
    },
    verificationToken: { type: String, default: null, select: false },
    verificationMethod: { type: String, enum: [...Object.values(VERIFICATION_METHODS), null], default: null },
    verifiedAt: { type: Date, default: null },
    lastVerificationAttemptAt: { type: Date, default: null },
    lastVerificationError: { type: String, default: null, maxlength: 300 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

websiteSchema.index({ workspace: 1, domain: 1 }, { unique: true });
websiteSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('Website', websiteSchema);
