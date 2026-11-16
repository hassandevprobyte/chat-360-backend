'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const {
  requireWorkspaceMember,
  requireWorkspacePermission,
} = require('../../../common/middleware/workspaceAccess');
const { PERMISSIONS } = require('../../../common/constants');
const schema = require('../schema/widget.schema');
const controller = require('../controller/widget.controller');

const router = express.Router();

router.get('/:workspaceId/widgets', validate(schema.listWidgets), requireWorkspaceMember, controller.list);
router.get('/:workspaceId/widgets/:widgetId', validate(schema.widgetParams), requireWorkspaceMember, controller.get);

router.post(
  '/:workspaceId/widgets',
  validate(schema.createWidget),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.WIDGET_MANAGE),
  controller.create,
);

router.patch(
  '/:workspaceId/widgets/:widgetId',
  validate(schema.updateWidget),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.WIDGET_MANAGE),
  controller.update,
);

router.post(
  '/:workspaceId/widgets/:widgetId/rotate-key',
  validate(schema.widgetParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.WIDGET_MANAGE),
  controller.rotateKey,
);

router.delete(
  '/:workspaceId/widgets/:widgetId',
  validate(schema.widgetParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.WIDGET_MANAGE),
  controller.remove,
);

module.exports = router;
