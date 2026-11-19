const mongoose = require("mongoose");

// Constants
const { MODELS, WEBSITE_STATUS, VERIFICATION_STATUS, VERIFICATION_METHODS } = require("../../common/constants");

const websiteSettingsSchema = {
  _id: false,
  enforceOriginCheck: {
    type: Boolean,
    default: true,
  },
  collectVisitorLocation: {
    type: Boolean,
    default: false,
  },
};

const schema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.WORKSPACE,
      required: [true, "workspace is required"],
    },
    title: {
      type: String,
      trim: true,
      maxlength: 120,
      required: [true, "title is required"],
    },
    domain: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 253,
      required: [true, "domain is required"],
    },
    // Extra origins (staging, www variants, `*.example.com`).
    allowedDomains: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(WEBSITE_STATUS),
      default: WEBSITE_STATUS.ACTIVE,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.UNVERIFIED,
    },
    verificationToken: {
      type: String,
      default: null,
    },
    verificationMethod: {
      type: String,
      enum: [...Object.values(VERIFICATION_METHODS), null],
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    lastVerificationAttemptAt: {
      type: Date,
      default: null,
    },
    lastVerificationError: {
      type: String,
      maxlength: 300,
      default: null,
    },
    settings: {
      type: websiteSettingsSchema,
      default: () => ({}),
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false },
);

schema.index({ workspace: 1, domain: 1 }, { unique: true });
schema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model(MODELS.WEBSITE, schema);
