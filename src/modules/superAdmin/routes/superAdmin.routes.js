'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const { authenticate } = require('../../../common/middleware/authenticate');
const requireSuperAdmin = require('../../../common/middleware/requireSuperAdmin');
const schema = require('../schema/superAdmin.schema');
const controller = require('../controller/superAdmin.controller');

const router = express.Router();

// Every route here is platform-level: authenticated AND platformRole SUPER_ADMIN.
router.use(authenticate, requireSuperAdmin);

router.get('/users', validate(schema.listUsers), controller.listUsers);
router.get('/users/:userId', validate(schema.userParams), controller.getUser);
router.patch('/users/:userId/status', validate(schema.setUserActive), controller.setUserActive);

router.get('/workspaces', validate(schema.listWorkspaces), controller.listWorkspaces);
router.get('/workspaces/:workspaceId', validate(schema.workspaceOnly), controller.getWorkspace);
router.get('/workspaces/:workspaceId/members', validate(schema.listMembers), controller.listMembers);
router.post('/workspaces/:workspaceId/suspend', validate(schema.suspendWorkspace), controller.suspend);
router.post('/workspaces/:workspaceId/reactivate', validate(schema.suspendWorkspace), controller.reactivate);
router.get('/workspaces/:workspaceId/conversations', validate(schema.listConversations), controller.listConversations);
router.get(
  '/workspaces/:workspaceId/conversations/:conversationId',
  validate(schema.inspectConversation),
  controller.inspectConversation,
);

module.exports = router;
