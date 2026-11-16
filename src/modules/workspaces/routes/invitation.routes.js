'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const { authenticate } = require('../../../common/middleware/authenticate');
const schema = require('../schema/workspace.schema');
const controller = require('../controller/workspace.controller');

const router = express.Router();

// Accepting an invitation happens outside any workspace scope: the caller is
// not a member yet. The token plus an email match is the authorization.
router.post('/accept', authenticate, validate(schema.acceptInvitation), controller.acceptInvitation);

module.exports = router;
