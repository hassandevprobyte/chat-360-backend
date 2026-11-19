const mongoose = require("mongoose");

// Constants
const { MODELS, WIDGET_POSITIONS } = require("../../common/constants");

const preChatFieldSchema = {
  _id: false,
  key: {
    type: String,
    enum: ["title", "email", "phone", "message"],
    required: [true, "key is required"],
  },
  label: {
    type: String,
    maxlength: 80,
    required: [true, "label is required"],
  },
  required: {
    type: Boolean,
    default: false,
  },
};

const businessHoursDaySchema = {
  _id: false,
  enabled: {
    type: Boolean,
    default: true,
  },
  // Minutes from midnight in the widget timezone. 540 = 09:00, 1020 = 17:00.
  from: {
    type: Number,
    default: 540,
    min: 0,
    max: 1440,
  },
  to: {
    type: Number,
    default: 1020,
    min: 0,
    max: 1440,
  },
};

const widgetSettingsSchema = {
  _id: false,
  primaryColor: {
    type: String,
    maxlength: 32,
    default: "#2563eb",
  },
  launcherColor: {
    type: String,
    maxlength: 32,
    default: "#2563eb",
  },
  textColor: {
    type: String,
    maxlength: 32,
    default: "#ffffff",
  },
  position: {
    type: String,
    enum: Object.values(WIDGET_POSITIONS),
    default: WIDGET_POSITIONS.BOTTOM_RIGHT,
  },
  offsetX: {
    type: Number,
    default: 20,
    min: 0,
    max: 200,
  },
  offsetY: {
    type: Number,
    default: 20,
    min: 0,
    max: 200,
  },
  logo: {
    type: String,
    default: null,
    maxlength: 512,
  },
  avatar: {
    type: String,
    default: null,
    maxlength: 512,
  },
  headerTitle: {
    type: String,
    maxlength: 80,
    default: "Chat with us",
  },
  headerSubtitle: {
    type: String,
    maxlength: 140,
    default: "We usually reply in a few minutes",
  },
  welcomeMessage: {
    type: String,
    maxlength: 500,
    default: "Hi there! How can we help?",
  },
  offlineMessage: {
    type: String,
    maxlength: 500,
    default: "We are offline right now. Leave a message and we will get back to you.",
  },
  launcherText: {
    type: String,
    maxlength: 60,
    default: null,
  },
  soundNotification: {
    type: Boolean,
    default: true,
  },
  fileUploadEnabled: {
    type: Boolean,
    default: true,
  },
  showAgentAvailability: {
    type: Boolean,
    default: true,
  },
  preChatForm: {
    enabled: {
      type: Boolean,
      default: false,
    },
    fields: {
      type: [preChatFieldSchema],
      default: () => [{ key: "name", label: "Your name", required: true }],
    },
  },
  businessHours: {
    enabled: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      default: "UTC",
      maxlength: 64,
    },
    days: {
      type: new mongoose.Schema(
        {
          mon: { type: businessHoursDaySchema, default: () => ({}) },
          tue: { type: businessHoursDaySchema, default: () => ({}) },
          wed: { type: businessHoursDaySchema, default: () => ({}) },
          thu: { type: businessHoursDaySchema, default: () => ({}) },
          fri: { type: businessHoursDaySchema, default: () => ({}) },
          sat: { type: businessHoursDaySchema, default: () => ({ enabled: false }) },
          sun: { type: businessHoursDaySchema, default: () => ({ enabled: false }) },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  branding: {
    showBranding: {
      type: Boolean,
      default: true,
    },
    brandingText: {
      type: String,
      maxlength: 60,
      default: "Powered by Chat360",
    },
    brandingUrl: {
      type: String,
      maxlength: 512,
      default: null,
    },
  },
};

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
    title: {
      type: String,
      trim: true,
      maxlength: 120,
      required: [true, "title is required"],
    },
    publicKey: {
      type: String,
      required: [true, "public key is required"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      type: widgetSettingsSchema,
      default: () => ({}),
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

schema.index({ publicKey: 1 }, { unique: true });
schema.index({ workspace: 1, website: 1 });
schema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model(MODELS.WIDGET, schema);
