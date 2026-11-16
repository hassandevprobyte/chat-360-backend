'use strict';

const mongoose = require('mongoose');

/**
 * Per-user canned responses, scoped to a workspace. The same user can have a
 * different `/pricing` in each workspace they belong to.
 */
const messageShortcutSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Stored without the leading slash, lowercase. The dashboard renders "/pricing".
    shortcut: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
    content: { type: String, required: true, maxlength: 4000 },
    isActive: { type: Boolean, default: true },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

messageShortcutSchema.index({ workspace: 1, user: 1, shortcut: 1 }, { unique: true });
messageShortcutSchema.index({ workspace: 1, user: 1, isActive: 1, shortcut: 1 });

module.exports = mongoose.model('MessageShortcut', messageShortcutSchema);
