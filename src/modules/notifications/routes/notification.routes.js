'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const { authenticate } = require('../../../common/middleware/authenticate');
const schema = require('../schema/notification.schema');
const controller = require('../controller/notification.controller');

const router = express.Router();

// Notifications belong to the user, not to a workspace, so they are read
// through /me-style routes and filtered by workspace on demand.
router.use(authenticate);

router.get('/', validate(schema.listNotifications), controller.list);
router.get('/unread-count', validate(schema.unreadCount), controller.unreadCount);
router.post('/read-all', validate(schema.markAllRead), controller.markAllRead);
router.patch('/:id/read', validate(schema.markRead), controller.markRead);

module.exports = router;
