const mongoose = require("mongoose");

// Constants
const { COLORS, MODELS } = require("../../common/constants");

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
      maxlength: 40,
      required: [true, "title is required"],
    },
    titleKey: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 40,
      required: [true, "title key is required"],
    },
    color: {
      type: String,
      enum: Object.values(COLORS),
      default: COLORS.GRAY,
    },
    description: {
      type: String,
      maxlength: 500,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.USER,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false },
);

schema.index({ workspace: 1, nameKey: 1 }, { unique: true });
schema.index({ workspace: 1, isActive: 1, name: 1 });

module.exports = mongoose.model(MODELS.TAG, schema);
