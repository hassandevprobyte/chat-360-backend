'use strict';

const mongoose = require('mongoose');

/**
 * Append-only audit trail. Never contains passwords, tokens or secrets - the
 * service layer whitelists metadata keys before writing.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // null for platform-level (Super Admin) actions with no tenant.
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorType: { type: String, enum: ['USER', 'SUPER_ADMIN', 'SYSTEM', 'VISITOR'], default: 'USER' },
    action: { type: String, required: true, maxlength: 80 },
    resource: { type: String, required: true, maxlength: 40 },
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, minimize: false },
);

auditLogSchema.index({ workspace: 1, createdAt: -1 });
auditLogSchema.index({ workspace: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
