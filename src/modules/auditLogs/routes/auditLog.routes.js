'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const {
  requireWorkspaceMember,
  requireWorkspaceRole,
} = require('../../../common/middleware/workspaceAccess');
const { WORKSPACE_ROLES } = require('../../../common/constants');
const schema = require('../schema/auditLog.schema');
const controller = require('../controller/auditLog.controller');

const router = express.Router();

// Audit logs are owner-only: they describe administrative activity.
router.get(
  '/:workspaceId/audit-logs',
  validate(schema.listAuditLogs),
  requireWorkspaceMember,
  requireWorkspaceRole(WORKSPACE_ROLES.OWNER),
  controller.list,
);

module.exports = router;
