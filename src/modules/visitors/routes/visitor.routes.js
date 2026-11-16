'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const { requireWorkspaceMember } = require('../../../common/middleware/workspaceAccess');
const schema = require('../schema/visitor.schema');
const controller = require('../controller/visitor.controller');

const router = express.Router();

router.get('/:workspaceId/visitors', validate(schema.listVisitors), requireWorkspaceMember, controller.list);
router.get('/:workspaceId/visitors/:visitorId', validate(schema.visitorParams), requireWorkspaceMember, controller.get);

module.exports = router;
