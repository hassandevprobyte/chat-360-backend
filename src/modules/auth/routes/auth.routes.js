'use strict';

const express = require('express');
const validate = require('../../../common/middleware/validate');
const { authenticate } = require('../../../common/middleware/authenticate');
const { authLimiter } = require('../../../common/middleware/rateLimit');
const schema = require('../schema/auth.schema');
const controller = require('../controller/auth.controller');

const router = express.Router();

// Credential endpoints get their own tight rate limit.
router.post('/register', authLimiter, validate(schema.register), controller.register);
router.post('/login', authLimiter, validate(schema.login), controller.login);
router.post('/refresh', validate(schema.refresh), controller.refresh);
router.post('/logout', validate(schema.logout), controller.logout);

router.post('/verify-email', authLimiter, validate(schema.verifyEmail), controller.verifyEmail);
router.post('/forgot-password', authLimiter, validate(schema.forgotPassword), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(schema.resetPassword), controller.resetPassword);

router.post('/resend-verification', authenticate, controller.resendVerification);
router.post('/change-password', authenticate, validate(schema.changePassword), controller.changePassword);

router.get('/sessions', authenticate, controller.listSessions);
router.delete('/sessions/:sessionId', authenticate, validate(schema.revokeSession), controller.revokeSession);

module.exports = router;
