'use strict';

const mongoose = require('mongoose');
const { WORKSPACE_ROLES, INVITATION_STATUS } = require('../../../common/constants');

const invitationSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    role: { type: String, enum: Object.values(WORKSPACE_ROLES), default: WORKSPACE_ROLES.AGENT },
    tokenHash: { type: String, required: true },
    status: { type: String, enum: Object.values(INVITATION_STATUS), default: INVITATION_STATUS.PENDING },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

invitationSchema.index({ tokenHash: 1 }, { unique: true });
// Only one outstanding invitation per email per workspace.
invitationSchema.index(
  { workspace: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: INVITATION_STATUS.PENDING } },
);
invitationSchema.index({ workspace: 1, createdAt: -1 });

module.exports = mongoose.model('Invitation', invitationSchema);
