const mongoose = require("mongoose");

// Constants
const { MODELS } = require("../../common/constants");

const schema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.WORKSPACE,
      required: [true, "workspace is required"],
    },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.WEBSITE,
      required: [true, "website is required"],
    },
    widget: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.WIDGET,
      default: null,
    },
    // Stable id generated server-side and kept by the widget in localStorage.
    anonymousId: {
      type: String,
      required: [true, "anonymous id is required"],
    },
    title: {
      type: String,
      default: null,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      maxlength: 40,
    },
    isIdentified: {
      type: Boolean,
      default: false,
    },
    currentPage: {
      type: String,
      default: null,
      maxlength: 512,
    },
    referrer: {
      type: String,
      default: null,
      maxlength: 512,
    },
    browser: {
      type: String,
      default: null,
      maxlength: 40,
    },
    operatingSystem: {
      type: String,
      default: null,
      maxlength: 40,
    },
    device: {
      type: String,
      default: null,
      maxlength: 20,
    },
    country: {
      type: String,
      default: null,
      maxlength: 2,
    },
    language: {
      type: String,
      default: null,
      maxlength: 16,
    },
    firstSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    sessionCount: {
      type: Number,
      default: 1,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

schema.index({ workspace: 1, anonymousId: 1 }, { unique: true });
schema.index({ workspace: 1, website: 1, lastSeenAt: -1 });
schema.index({ workspace: 1, lastSeenAt: -1 });
schema.index({ workspace: 1, isOnline: 1 });
schema.index({ workspace: 1, email: 1 });

module.exports = mongoose.model(MODELS.VISITOR, schema);
