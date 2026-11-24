const mongoose = require("mongoose");

// Constants
const { LOCALES, MODELS, TIMEZONE, WIDGET } = require("../../common/constants");

const preChatFieldSchema = {
  _id: false,
  key: {
    type: String,
    enum: Object.values(WIDGET.PRE_CHAT_FIELDS),
    required: [true, "key is required"],
  },
  label: {
    type: String,
    maxlength: 80,
    required: [true, "label is required"],
  },
  required: {
    type: Boolean,
    default: true,
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
  style: {
    primaryColor: {
      type: String,
      maxlength: 32,
      required: [true, "primary color is required"],
    },
    launcherColor: {
      type: String,
      maxlength: 32,
      required: [true, "primary color is required"],
    },
    textColor: {
      type: String,
      maxlength: 32,
      required: [true, "primary color is required"],
    },
    position: {
      type: String,
      enum: Object.values(WIDGET.WIDGET_POSITIONS),
      required: [true, "position is required"],
    },
    offsetX: {
      type: Number,
      min: 0,
      max: 200,
      required: [true, "offset X is required"],
    },
    offsetY: {
      type: Number,
      min: 0,
      max: 200,
      required: [true, "offset Y is required"],
    },
  },
  message: {
    welcome: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, "welcome message is required"],
    },
    offline: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, "offline message is required"],
    },
  },
  header: {
    logo: {
      type: String,
    },
    avatar: {
      type: String,
    },
    title: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, "header title is required"],
    },
    subtitle: {
      type: String,
      trim: true,
      lowercase: true,
      required: [true, "header subtitle is required"],
    },
  },
  launcher: {
    textEnabled: {
      type: Boolean,
      default: true,
    },
    text: {
      type: String,
      required: [
        function () {
          return this.textEnabled;
        },
        "Launcher text is required when text is enabled.",
      ],
    },
    icon: {
      type: String,
      required: [true, "Launcher icon is required"],
    },
  },
  preChatForm: {
    enabled: {
      type: Boolean,
      default: false,
    },
    fields: {
      type: [preChatFieldSchema],
      validate: {
        validator: function (fields) {
          return !this.enabled || fields.length >= 1;
        },
        message: "At least one pre-chat field is required when the pre-chat form is enabled.",
      },
    },
  },
  businessHours: {
    enabled: {
      type: Boolean,
      default: false,
    },
    timezone: {
      type: String,
      enum: Object.values(TIMEZONE),
      default: TIMEZONE.UTC,
    },
    days: {
      type: {
        mon: { type: businessHoursDaySchema, default: () => ({}) },
        tue: { type: businessHoursDaySchema, default: () => ({}) },
        wed: { type: businessHoursDaySchema, default: () => ({}) },
        thu: { type: businessHoursDaySchema, default: () => ({}) },
        fri: { type: businessHoursDaySchema, default: () => ({}) },
        sat: { type: businessHoursDaySchema, default: () => ({ enabled: false }) },
        sun: { type: businessHoursDaySchema, default: () => ({ enabled: false }) },
        _id: false,
      },
      default: () => ({}),
    },
  },
  branding: {
    showBranding: {
      type: Boolean,
      default: true,
    },
    logo: {
      type: String,
      default: null,
    },
    text: {
      type: String,
      default: "Powered by Chat360",
    },
    url: {
      type: String,
      default: null,
    },
  },
  locale: {
    type: String,
    enum: Object.values(LOCALES),
    default: LOCALES.EN_US,
  },
  soundNotification: {
    type: Boolean,
    default: true,
  },
  showTypingIndicator: {
    type: Boolean,
    default: true,
  },
  showAgentAvailability: {
    type: Boolean,
    default: false,
  },
  fileUploadEnabled: {
    type: Boolean,
    default: false,
  },
  showQuickReplies: {
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
    secretKey: {
      type: String,
      required: [true, "secret key is required"],
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
