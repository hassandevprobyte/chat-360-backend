'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const { publicLimiter, visitorMessageLimiter, uploadLimiter } = require('../../../common/middleware/rateLimit');
const { uploadSingle } = require('../../../common/middleware/upload');
const visitorAuth = require('../middleware/visitorAuth');
const schema = require('../schema/public.schema');
const controller = require('../controller/public.controller');

const router = express.Router();

/**
 * Mounted at /api/v1/public. Nothing here uses dashboard authentication.
 *
 * Unauthenticated: widget config + visitor init (returns the visitor token).
 * Everything else requires a visitor session (visitorAuth), which re-derives
 * the tenant from the token and re-checks the request origin.
 */
router.use(publicLimiter);

router.get('/widgets/:publicKey', validate(schema.widgetConfig), controller.getConfig);
router.post('/widgets/:publicKey/visitors/init', validate(schema.initVisitor), controller.init);

router.use(visitorAuth);

router.patch('/visitors/me', validate(schema.identify), controller.identify);
router.post('/visitors/me/activity', validate(schema.activity), controller.activity);
router.post('/visitors/me/leave', controller.leave);

router.get('/conversations', validate(schema.listConversations), controller.listConversations);
router.post('/conversations', visitorMessageLimiter, validate(schema.startConversation), controller.startConversation);
router.get('/conversations/:conversationId', validate(schema.conversationOnly), controller.getConversation);
router.get('/conversations/:conversationId/messages', validate(schema.listMessages), controller.listMessages);
router.post(
  '/conversations/:conversationId/messages',
  visitorMessageLimiter,
  validate(schema.sendMessage),
  controller.sendMessage,
);
router.post('/conversations/:conversationId/read', validate(schema.conversationOnly), controller.markRead);
router.post('/conversations/:conversationId/close', validate(schema.conversationOnly), controller.closeConversation);

router.post('/attachments', uploadLimiter, uploadSingle, validate(schema.uploadAttachment), controller.uploadAttachment);
router.get('/attachments/:attachmentId/download', validate(schema.attachmentParams), controller.downloadAttachment);

module.exports = router;
