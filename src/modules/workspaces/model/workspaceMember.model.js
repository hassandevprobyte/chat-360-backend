'use strict';

const mongoose = require('mongoose');
const { WORKSPACE_ROLES, PERMISSIONS } = require('../../../common/constants');

/**
 * The join table that makes multi-tenancy work. Authorization is *always*
 * derived from an active record here - never from a client-supplied role.
 *
 * There is no Agent collection: an agent is a User with an active
 * WorkspaceMember whose role is AGENT. OWNER can act as an agent too.
 */
const workspaceMemberSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: Object.values(WORKSPACE_ROLES), required: true },
    // Additive grants on top of the role defaults (future extensibility hook).
    permissions: { type: [{ type: String, enum: Object.values(PERMISSIONS) }], default: [] },
    isActive: { type: Boolean, default: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, versionKey: false },
);

workspaceMemberSchema.index({ workspace: 1, user: 1 }, { unique: true });
workspaceMemberSchema.index({ workspace: 1, role: 1, isActive: 1 });
workspaceMemberSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('WorkspaceMember', workspaceMemberSchema);
