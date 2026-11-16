'use strict';

const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    // Lowercased copy used for the uniqueness guarantee inside a workspace.
    nameKey: { type: String, required: true, lowercase: true, trim: true, maxlength: 40 },
    color: { type: String, default: '#64748b', maxlength: 32 },
    description: { type: String, default: null, maxlength: 200 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

tagSchema.index({ workspace: 1, nameKey: 1 }, { unique: true });
tagSchema.index({ workspace: 1, isActive: 1, name: 1 });

module.exports = mongoose.model('Tag', tagSchema);
