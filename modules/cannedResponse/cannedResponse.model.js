const mongoose = require("mongoose");

// Constants
const { CANNED_RESPONSE, MODELS } = require("../../common/constants");

const schema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.WORKSPACE,
      required: [true, "workspace is required"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.USER,
      required: [true, "user is required"],
    },
    title: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, "title is required"],
    },
    category: {
      type: String,
      enum: Object.values(CANNED_RESPONSE.CATEGORY),
      required: [true, "category is required"],
    },
    visibility: {
      type: String,
      enum: Object.values(CANNED_RESPONSE.VISIBILITY),
      default: CANNED_RESPONSE.VISIBILITY.SHARED,
    },
    tags: {
      type: [{ type: String, trim: true, lowercase: true }],
      default: [],
    },
    shortcut: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 41,
      required: [true, "shortcut is required"],
    },
    content: {
      type: String,
      maxlength: 4000,
      required: [true, "content is required"],
    },
    placeholders: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

schema.index({ workspace: 1, user: 1, shortcut: 1 }, { unique: true });
schema.index({ workspace: 1, user: 1, isActive: 1, shortcut: 1 });

module.exports = mongoose.model(MODELS.CANNED_RESPONSE, schema);
