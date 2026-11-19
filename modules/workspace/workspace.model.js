const mongoose = require("mongoose");

// Constants
const { COLORS, CURRENCY, LOCALES, MODELS, STATUSES, TIMEZONE } = require("../../common/constants");

const agentschema = {
  _id: false,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: MODELS.USER,
    required: [true, "user is required"],
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
};

const settingSchema = {
  _id: false,
  timezone: {
    type: String,
    enum: Object.values(TIMEZONE),
    default: TIMEZONE.UTC,
  },
  currency: {
    type: String,
    enum: Object.values(CURRENCY),
    default: CURRENCY.USD,
  },
  locale: {
    type: String,
    enum: Object.values(LOCALES),
    default: LOCALES.EN_US,
  },
};

const schema = new mongoose.Schema(
  {
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
    description: {
      type: String,
      trim: true,
      lowercase: true,
    },
    slug: {
      type: String,
      trim: true,
      required: [true, "slug is required"],
    },
    color: {
      type: String,
      enum: Object.values(COLORS),
      default: COLORS.GRAY,
    },
    status: {
      type: String,
      enum: Object.values(STATUSES.WORKSPACE),
      default: STATUSES.WORKSPACE.ACTIVE,
    },
    agents: {
      type: [agentschema],
      default: [],
      validate: {
        validator: (agents) => new Set(agents.map((agent) => String(agent.user))).size === agents.length,
        message: "workspace agents must be unique",
      },
    },
    settings: {
      type: settingSchema,
      default: () => ({}),
    },
  },
  { timestamps: true },
);

schema.index({ user: 1 }, { unique: true });
schema.index({ "agents.user": 1 });

module.exports = mongoose.model(MODELS.WORKSPACE, schema);
