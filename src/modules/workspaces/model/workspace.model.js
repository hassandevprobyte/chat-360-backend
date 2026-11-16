'use strict';

const mongoose = require('mongoose');

const workspaceSettingsSchema = new mongoose.Schema(
  {
    timezone: { type: String, default: 'UTC', maxlength: 64 },
    locale: { type: String, default: 'en', maxlength: 16 },
    // Agents may close conversations they are not assigned to.
    allowAgentCloseUnassigned: { type: Boolean, default: false },
    // Notify all eligible agents by email when a conversation goes unassigned.
    emailOnNewConversation: { type: Boolean, default: true },
    emailOnNewMessage: { type: Boolean, default: false },
    conversationAutoCloseHours: { type: Number, default: 0, min: 0, max: 720 },
  },
  { _id: false },
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 64 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    settings: { type: workspaceSettingsSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
    suspendedAt: { type: Date, default: null },
    suspendedReason: { type: String, default: null, maxlength: 300 },
  },
  { timestamps: true, versionKey: false },
);

workspaceSchema.index({ slug: 1 }, { unique: true });
workspaceSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
