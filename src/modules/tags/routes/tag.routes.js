'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const {
  requireWorkspaceMember,
  requireWorkspacePermission,
} = require('../../../common/middleware/workspaceAccess');
const { PERMISSIONS } = require('../../../common/constants');
const schema = require('../schema/tag.schema');
const controller = require('../controller/tag.controller');

const router = express.Router();

// Agents read tags and apply them to conversations; only TAG_MANAGE (OWNER in
// v1) can change the tag catalogue itself.
router.get('/:workspaceId/tags', validate(schema.listTags), requireWorkspaceMember, controller.list);
router.get('/:workspaceId/tags/:tagId', validate(schema.tagParams), requireWorkspaceMember, controller.get);

router.post(
  '/:workspaceId/tags',
  validate(schema.createTag),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.TAG_MANAGE),
  controller.create,
);

router.patch(
  '/:workspaceId/tags/:tagId',
  validate(schema.updateTag),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.TAG_MANAGE),
  controller.update,
);

router.delete(
  '/:workspaceId/tags/:tagId',
  validate(schema.tagParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.TAG_MANAGE),
  controller.remove,
);

module.exports = router;
