'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { requestId, httpLogger } = require('./common/middleware/requestContext');
const { errorHandler, notFoundHandler } = require('./common/middleware/errorHandler');
const routes = require('./routes');

/**
 * Express application factory. Kept free of network/DB side effects so tests
 * can build an app instance against an in-memory database.
 */
function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', 1);

  app.use(requestId);
  if (!env.isTest) app.use(httpLogger);

  app.use(
    helmet({
      // The API serves JSON and file downloads only; a strict CSP is harmless.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  /**
   * Two CORS regimes:
   *  - /api/v1/public/* is embedded on arbitrary customer sites, so any origin
   *    may call it; tenancy and origin allow-lists are enforced per widget by
   *    the widget context, not by CORS.
   *  - everything else is dashboard-only and limited to configured origins.
   */
  app.use(
    '/api/v1/public',
    cors({
      origin: true,
      credentials: false,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Visitor-Token', 'X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    }),
  );

  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: env.rateLimit.bodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: env.rateLimit.bodyLimit }));

  app.get('/', (req, res) => res.json({ success: true, data: { name: env.app.name, api: '/api/v1' } }));
  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
