'use strict';

const mongoose = require('mongoose');
const { WIDGET_POSITIONS } = require('../../../common/constants');

const preChatFieldSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['name', 'email', 'phone', 'message'], required: true },
    label: { type: String, required: true, maxlength: 80 },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const businessHoursDaySchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    // Minutes from midnight in the widget timezone. 540 = 09:00, 1020 = 17:00.
    from: { type: Number, default: 540, min: 0, max: 1440 },
    to: { type: Number, default: 1020, min: 0, max: 1440 },
  },
  { _id: false },
);

const widgetSettingsSchema = new mongoose.Schema(
  {
    primaryColor: { type: String, default: '#2563eb', maxlength: 32 },
    launcherColor: { type: String, default: '#2563eb', maxlength: 32 },
    textColor: { type: String, default: '#ffffff', maxlength: 32 },
    position: { type: String, enum: Object.values(WIDGET_POSITIONS), default: WIDGET_POSITIONS.BOTTOM_RIGHT },
    offsetX: { type: Number, default: 20, min: 0, max: 200 },
    offsetY: { type: Number, default: 20, min: 0, max: 200 },
    logo: { type: String, default: null, maxlength: 512 },
    avatar: { type: String, default: null, maxlength: 512 },
    headerTitle: { type: String, default: 'Chat with us', maxlength: 80 },
    headerSubtitle: { type: String, default: 'We usually reply in a few minutes', maxlength: 140 },
    welcomeMessage: { type: String, default: 'Hi there! How can we help?', maxlength: 500 },
    offlineMessage: {
      type: String,
      default: 'We are offline right now. Leave a message and we will get back to you.',
      maxlength: 500,
    },
    launcherText: { type: String, default: null, maxlength: 60 },
    soundNotification: { type: Boolean, default: true },
    fileUploadEnabled: { type: Boolean, default: true },
    showAgentAvailability: { type: Boolean, default: true },
    preChatForm: {
      enabled: { type: Boolean, default: false },
      fields: { type: [preChatFieldSchema], default: () => [{ key: 'name', label: 'Your name', required: true }] },
    },
    businessHours: {
      enabled: { type: Boolean, default: false },
      timezone: { type: String, default: 'UTC', maxlength: 64 },
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
      showBranding: { type: Boolean, default: true },
      brandingText: { type: String, default: 'Powered by LiveChat', maxlength: 60 },
      brandingUrl: { type: String, default: null, maxlength: 512 },
    },
  },
  { _id: false },
);

const widgetSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    website: { type: mongoose.Schema.Types.ObjectId, ref: 'Website', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Public, non-secret identifier embedded in the customer's page.
    publicKey: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    settings: { type: widgetSettingsSchema, default: () => ({}) },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

widgetSchema.index({ publicKey: 1 }, { unique: true });
widgetSchema.index({ workspace: 1, website: 1 });
widgetSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('Widget', widgetSchema);
