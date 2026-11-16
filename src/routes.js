'use strict';

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { authenticate } = require('./common/middleware/authenticate');
const { apiLimiter } = require('./common/middleware/rateLimit');
const { ok } = require('./common/response');
const env = require('./config/env');
const { mongoose } = require('./config/database');
const { getRedis, isRedisDisabled } = require('./config/redis');
const openapi = require('./docs/openapi.json');

const authRoutes = require('./modules/auth/routes/auth.routes');
const userRoutes = require('./modules/users/routes/user.routes');
const workspaceRoutes = require('./modules/workspaces/routes/workspace.routes');
const invitationRoutes = require('./modules/workspaces/routes/invitation.routes');
const websiteRoutes = require('./modules/websites/routes/website.routes');
const widgetRoutes = require('./modules/widgets/routes/widget.routes');
const visitorRoutes = require('./modules/visitors/routes/visitor.routes');
const conversationRoutes = require('./modules/conversations/routes/conversation.routes');
const shortcutRoutes = require('./modules/messageShortcuts/routes/messageShortcut.routes');
const tagRoutes = require('./modules/tags/routes/tag.routes');
const attachmentRoutes = require('./modules/attachments/routes/attachment.routes');
const auditLogRoutes = require('./modules/auditLogs/routes/auditLog.routes');
const notificationRoutes = require('./modules/notifications/routes/notification.routes');
const superAdminRoutes = require('./modules/superAdmin/routes/superAdmin.routes');
const publicRoutes = require('./modules/public/routes/public.routes');

const router = express.Router();

/* --------------------------------- health --------------------------------- */

router.get('/health', async (req, res) => {
  let redis = 'disabled';
  if (!isRedisDisabled()) {
    try {
      redis = (await getRedis().ping()) === 'PONG' ? 'ok' : 'degraded';
    } catch (err) {
      redis = 'down';
    }
  }
  const mongo = mongoose.connection.readyState === 1 ? 'ok' : 'down';
  const healthy = mongo === 'ok' && redis !== 'down';
  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: { status: healthy ? 'ok' : 'degraded', mongo, redis, version: env.app.name, uptime: process.uptime() },
  });
});

/* ---------------------------------- docs ---------------------------------- */

router.get('/docs.json', (req, res) => ok(res, openapi));
router.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: `${env.app.name} API` }));

/* --------------------------------- public --------------------------------- */

// Widget API: its own auth (visitor tokens) and its own rate limits.
router.use('/public', publicRoutes);

/* -------------------------------- dashboard ------------------------------- */

router.use('/auth', authRoutes);

// Everything below is an authenticated dashboard route.
router.use('/me', apiLimiter, userRoutes);
router.use('/notifications', apiLimiter, notificationRoutes);
router.use('/invitations', apiLimiter, invitationRoutes);
router.use('/super-admin', apiLimiter, superAdminRoutes);

// Workspace-scoped modules all hang off /workspaces/:workspaceId/... and each
// applies requireWorkspaceMember internally.
router.use('/workspaces', authenticate, apiLimiter, [
  workspaceRoutes,
  websiteRoutes,
  widgetRoutes,
  visitorRoutes,
  conversationRoutes,
  shortcutRoutes,
  tagRoutes,
  attachmentRoutes,
  auditLogRoutes,
]);

module.exports = router;
