'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const {
  requireWorkspaceMember,
  requireWorkspacePermission,
} = require('../../../common/middleware/workspaceAccess');
const { PERMISSIONS } = require('../../../common/constants');
const schema = require('../schema/website.schema');
const controller = require('../controller/website.controller');

const router = express.Router();

// Agents may read websites (they need names for filters) but not manage them.
router.get('/:workspaceId/websites', validate(schema.listWebsites), requireWorkspaceMember, controller.list);
router.get('/:workspaceId/websites/:websiteId', validate(schema.websiteParams), requireWorkspaceMember, controller.get);

router.post(
  '/:workspaceId/websites',
  validate(schema.createWebsite),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.WEBSITE_MANAGE),
  controller.create,
);

router.patch(
  '/:workspaceId/websites/:websiteId',
  validate(schema.updateWebsite),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.WEBSITE_MANAGE),
  controller.update,
);

router.delete(
  '/:workspaceId/websites/:websiteId',
  validate(schema.websiteParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.WEBSITE_MANAGE),
  controller.remove,
);

// Domain ownership verification (DNS TXT / meta tag / file upload).
// Reading instructions only requires membership; issuing a token or running a
// live check is a management action, same tier as the rest of this router.
router.get(
  '/:workspaceId/websites/:websiteId/verification',
  validate(schema.websiteParams),
  requireWorkspaceMember,
  controller.getVerification,
);

router.post(
  '/:workspaceId/websites/:websiteId/verification/rotate',
  validate(schema.websiteParams),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.WEBSITE_MANAGE),
  controller.rotateVerificationToken,
);

router.post(
  '/:workspaceId/websites/:websiteId/verify',
  validate(schema.verifyWebsite),
  requireWorkspaceMember,
  requireWorkspacePermission(PERMISSIONS.WEBSITE_MANAGE),
  controller.verify,
);

module.exports = router;
