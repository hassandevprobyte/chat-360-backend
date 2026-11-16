'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const { requireWorkspaceMember } = require('../../../common/middleware/workspaceAccess');
const { uploadSingle } = require('../../../common/middleware/upload');
const { uploadLimiter } = require('../../../common/middleware/rateLimit');
const schema = require('../schema/attachment.schema');
const controller = require('../controller/attachment.controller');

const router = express.Router();

// `validate` runs before multer so a bad workspaceId never buffers a file.
router.post(
  '/:workspaceId/attachments',
  validate(schema.uploadAttachment),
  requireWorkspaceMember,
  uploadLimiter,
  uploadSingle,
  controller.upload,
);

router.get('/:workspaceId/attachments', validate(schema.listAttachments), requireWorkspaceMember, controller.list);

router.get(
  '/:workspaceId/attachments/:attachmentId',
  validate(schema.attachmentParams),
  requireWorkspaceMember,
  controller.get,
);

router.get(
  '/:workspaceId/attachments/:attachmentId/download',
  validate(schema.attachmentParams),
  requireWorkspaceMember,
  controller.download,
);

router.delete(
  '/:workspaceId/attachments/:attachmentId',
  validate(schema.attachmentParams),
  requireWorkspaceMember,
  controller.remove,
);

module.exports = router;
