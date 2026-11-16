'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const { requireWorkspaceMember } = require('../../../common/middleware/workspaceAccess');
const schema = require('../schema/messageShortcut.schema');
const controller = require('../controller/messageShortcut.controller');

const router = express.Router();

/**
 * Shortcuts are personal but workspace-scoped: the same user has a different
 * set in every workspace they belong to. Ownership is enforced in the
 * repository by querying on { workspace, user }, so there is no extra
 * role check here - any member manages only their own records.
 */
router.get(
  '/:workspaceId/message-shortcuts',
  validate(schema.listShortcuts),
  requireWorkspaceMember,
  controller.list,
);

router.post(
  '/:workspaceId/message-shortcuts',
  validate(schema.createShortcut),
  requireWorkspaceMember,
  controller.create,
);

router.get(
  '/:workspaceId/message-shortcuts/:shortcutId',
  validate(schema.shortcutParams),
  requireWorkspaceMember,
  controller.get,
);

router.patch(
  '/:workspaceId/message-shortcuts/:shortcutId',
  validate(schema.updateShortcut),
  requireWorkspaceMember,
  controller.update,
);

router.delete(
  '/:workspaceId/message-shortcuts/:shortcutId',
  validate(schema.shortcutParams),
  requireWorkspaceMember,
  controller.remove,
);

module.exports = router;
