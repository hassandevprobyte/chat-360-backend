'use strict';

const pino = require('pino');
const env = require('../../config/env');

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.currentPassword',
  'req.body.newPassword',
  'req.body.token',
  'req.body.refreshToken',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'visitorToken',
  'secret',
  '*.password',
  '*.token',
];

const transport = env.log.pretty && !env.isProduction
  ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
  : undefined;

const logger = pino({
  level: env.isTest ? 'silent' : env.log.level,
  base: { service: 'livechat-api', env: env.nodeEnv },
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  transport,
});

module.exports = logger;
