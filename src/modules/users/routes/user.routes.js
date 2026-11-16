'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const { authenticate } = require('../../../common/middleware/authenticate');
const schema = require('../schema/user.schema');
const controller = require('../controller/user.controller');

const router = express.Router();

router.use(authenticate);
router.get('/', controller.me);
router.patch('/', validate(schema.updateMe), controller.updateMe);

module.exports = router;
