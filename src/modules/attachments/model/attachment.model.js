'use strict';

const mongoose = require('mongoose');
const { ATTACHMENT_RESOURCES } = require('../../../common/constants');

const attachmentSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    resource: { type: String, enum: Object.values(ATTACHMENT_RESOURCES), required: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
    originalName: { type: String, required: true, maxlength: 255 },
    fileName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true },
    // Provider-relative key. Never a filesystem path exposed to clients.
    storageKey: { type: String, required: true, maxlength: 512 },
    storageDriver: { type: String, default: 'local', maxlength: 20 },
    checksum: { type: String, default: null, maxlength: 64 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedByVisitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', default: null },
    // Extension point for a virus scanning pipeline.
    scanStatus: { type: String, enum: ['SKIPPED', 'PENDING', 'CLEAN', 'INFECTED'], default: 'SKIPPED' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

attachmentSchema.index({ workspace: 1, createdAt: -1 });
attachmentSchema.index({ workspace: 1, conversation: 1, createdAt: -1 });
attachmentSchema.index({ workspace: 1, resource: 1, resourceId: 1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
