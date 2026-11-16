'use strict';

const mongoose = require('mongoose');
const { NOTIFICATION_TYPES } = require('../../../common/constants');

const notificationSchema = new mongoose.Schema(
  {
    // Workspace is nullable: platform level notifications have no tenant.
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    title: { type: String, required: true, maxlength: 160 },
    message: { type: String, default: '', maxlength: 500 },
    // Deep-link payload for the dashboard (conversationId, visitorId, ...).
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ user: 1, workspace: 1, createdAt: -1 });
notificationSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
