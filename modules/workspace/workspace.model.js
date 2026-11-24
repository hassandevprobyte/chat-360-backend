const mongoose = require("mongoose");

// Constants
const { COLORS, CURRENCY, LOCALES, MODELS, STATUSES, TIMEZONE, WORKSPACE, WORKSPACE_ROLES } = require("../../common/constants");

const agentschema = {
  _id: false,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: MODELS.USER,
    required: [true, "user is required"],
  },
  role: {
    type: String,
    enum: Object.values(WORKSPACE_ROLES),
    default: WORKSPACE_ROLES.AGENT,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
};

const settingSchema = {
  _id: false,
  color: {
    type: String,
    enum: Object.values(COLORS),
    default: COLORS.GRAY,
  },
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
  allowedIPs: [
    {
      type: String,
      trim: true,
    },
  ],
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
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    website: {
      type: String,
      trim: true,
      lowercase: true,
    },
    industry: {
      type: String,
      enum: Object.values(WORKSPACE.INDUSTRY),
    },
    comapnySize: {
      type: String,
      enum: Object.values(WORKSPACE.COMPANY_SIZE),
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
    image: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.ATTACHMENT,
    },
    status: {
      type: String,
      enum: Object.values(STATUSES.WORKSPACE),
      default: STATUSES.WORKSPACE.ACTIVE,
    },
    agents: {
      type: [agentschema],
      default: [],
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
