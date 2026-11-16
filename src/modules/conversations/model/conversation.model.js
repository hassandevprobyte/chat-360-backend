'use strict';

const mongoose = require('mongoose');
const { CONVERSATION_STATUS, CONVERSATION_PRIORITY } = require('../../../common/constants');

const lastMessagePreviewSchema = new mongoose.Schema(
  {
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    senderType: { type: String, default: null },
    type: { type: String, default: null },
    preview: { type: String, default: null, maxlength: 200 },
    createdAt: { type: Date, default: null },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    website: { type: mongoose.Schema.Types.ObjectId, ref: 'Website', required: true },
    widget: { type: mongoose.Schema.Types.ObjectId, ref: 'Widget', required: true },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'Visitor', required: true },
    // null => sits in the unassigned queue, visible to every eligible member.
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: Object.values(CONVERSATION_STATUS),
      default: CONVERSATION_STATUS.OPEN,
    },
    priority: {
      type: String,
      enum: Object.values(CONVERSATION_PRIORITY),
      default: CONVERSATION_PRIORITY.NORMAL,
    },
    subject: { type: String, default: null, maxlength: 160 },
    tags: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }], default: [] },
    lastMessage: { type: lastMessagePreviewSchema, default: () => ({}) },
    lastMessageAt: { type: Date, default: Date.now },
    // Set once, on the first visitor-visible agent reply. Drives first response time.
    firstResponseAt: { type: Date, default: null },
    firstAgentReplyBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reopenedAt: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
    visitorUnreadCount: { type: Number, default: 0 },
    agentUnreadCount: { type: Number, default: 0 },
    visitorLastReadAt: { type: Date, default: null },
    agentLastReadAt: { type: Date, default: null },
    startedPage: { type: String, default: null, maxlength: 512 },
  },
  { timestamps: true, versionKey: false },
);

conversationSchema.index({ workspace: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ workspace: 1, assignedTo: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ workspace: 1, visitor: 1, createdAt: -1 });
conversationSchema.index({ workspace: 1, website: 1, createdAt: -1 });
conversationSchema.index({ workspace: 1, widget: 1, createdAt: -1 });
conversationSchema.index({ workspace: 1, tags: 1 });
// The unassigned queue is served by { workspace, assignedTo, status, lastMessageAt }
// above: assignedTo === null is just another value of that key.

module.exports = mongoose.model('Conversation', conversationSchema);
