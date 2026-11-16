'use strict';

const mongoose = require('mongoose');
const { SENDER_TYPES, MESSAGE_TYPES } = require('../../../common/constants');

const messageAttachmentSchema = new mongoose.Schema(
  {
    attachment: { type: mongoose.Schema.Types.ObjectId, ref: 'Attachment', required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true, maxlength: 120 },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderType: { type: String, enum: Object.values(SENDER_TYPES), required: true },
    // Set when senderType === USER (an agent or owner).
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Set when senderType === VISITOR. Also denormalised on agent messages so
    // visitor-scoped queries stay single-collection.
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', default: null },
    type: { type: String, enum: Object.values(MESSAGE_TYPES), default: MESSAGE_TYPES.TEXT },
    content: { type: String, default: '', maxlength: 10000 },
    attachments: { type: [messageAttachmentSchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

messageSchema.index({ workspace: 1, conversation: 1, createdAt: -1 });
messageSchema.index({ workspace: 1, conversation: 1, _id: -1 });
messageSchema.index({ workspace: 1, createdAt: -1 });
messageSchema.index({ workspace: 1, senderType: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, senderType: 1, readAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
