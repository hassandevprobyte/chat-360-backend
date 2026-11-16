'use strict';

const crypto = require('crypto');
const pinoHttp = require('pino-http');
const logger = require('../logger');
const env = require('../../config/env');

/** Correlation id: reuses an upstream x-request-id when present. */
function requestId(req, res, next) {
  req.id = req.get('x-request-id') || crypto.randomBytes(8).toString('hex');
  res.setHeader('x-request-id', req.id);
  return next();
}

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  autoLogging: {
    // Health checks and socket polling would drown the log.
    ignore: (req) => req.url === '/health' || req.url === '/api/v1/health' || req.url.startsWith('/socket.io'),
  },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return env.isProduction ? 'info' : 'debug';
  },
  customProps: (req) => ({
    userId: req.user ? req.user.id : undefined,
    workspaceId: req.workspaceId ? String(req.workspaceId) : undefined,
  }),
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = { requestId, httpLogger };
