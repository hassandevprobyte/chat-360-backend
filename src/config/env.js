'use strict';

require('dotenv').config();

const path = require('path');
const Joi = require('joi');

const bool = (def) => Joi.boolean().truthy('true', '1').falsy('false', '0').default(def);

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(4000),
  APP_NAME: Joi.string().default('LiveChat'),
  APP_URL: Joi.string().uri().default('http://localhost:4000'),
  API_URL: Joi.string().uri().default('http://localhost:4000/api/v1'),
  DASHBOARD_URL: Joi.string().uri().default('http://localhost:3000'),
  WIDGET_URL: Joi.string().uri().default('http://localhost:3001'),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  TRUST_PROXY: bool(false),

  MONGO_URI: Joi.string().required(),
  MONGO_DEBUG: bool(false),

  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  REDIS_PREFIX: Joi.string().default('livechat'),
  REDIS_DISABLED: bool(false),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_WIDGET_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  JWT_WIDGET_EXPIRES_IN: Joi.string().default('7d'),
  EMAIL_TOKEN_EXPIRES_IN: Joi.string().default('24h'),
  PASSWORD_RESET_EXPIRES_IN: Joi.string().default('1h'),
  INVITATION_EXPIRES_IN: Joi.string().default('7d'),
  REFRESH_COOKIE_ENABLED: bool(true),
  REFRESH_COOKIE_NAME: Joi.string().default('lc_rt'),
  COOKIE_DOMAIN: Joi.string().allow('').default(''),

  MAIL_DRIVER: Joi.string().valid('smtp', 'log').default('smtp'),
  SMTP_HOST: Joi.string().allow('').default('localhost'),
  SMTP_PORT: Joi.number().default(1025),
  SMTP_SECURE: bool(false),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASSWORD: Joi.string().allow('').default(''),
  SMTP_FROM: Joi.string().default('LiveChat <no-reply@example.com>'),

  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  UPLOAD_DIR: Joi.string().default('./storage/uploads'),
  MAX_FILE_SIZE: Joi.number().default(10 * 1024 * 1024),
  S3_ENDPOINT: Joi.string().allow('').default(''),
  S3_REGION: Joi.string().allow('').default(''),
  S3_BUCKET: Joi.string().allow('').default(''),
  S3_ACCESS_KEY_ID: Joi.string().allow('').default(''),
  S3_SECRET_ACCESS_KEY: Joi.string().allow('').default(''),
  S3_PUBLIC_BASE_URL: Joi.string().allow('').default(''),
  S3_FORCE_PATH_STYLE: bool(true),

  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX: Joi.number().default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  AUTH_RATE_LIMIT_MAX: Joi.number().default(20),
  PUBLIC_RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  PUBLIC_RATE_LIMIT_MAX: Joi.number().default(120),
  BODY_LIMIT: Joi.string().default('100kb'),

  WIDGET_CONFIG_CACHE_TTL: Joi.number().default(300),
  PRESENCE_TTL: Joi.number().default(90),

  WORKER_CONCURRENCY: Joi.number().default(5),
  ENABLE_SCHEDULED_JOBS: bool(true),

  LOG_LEVEL: Joi.string().default('info'),
  LOG_PRETTY: bool(false),
}).unknown(true);

const { value: raw, error } = schema.validate(process.env, { abortEarly: false, stripUnknown: false });

if (error) {
  // Fail fast: an app with a broken configuration must never boot.
  const details = error.details.map((d) => `  - ${d.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const list = (str) => String(str || '').split(',').map((s) => s.trim()).filter(Boolean);

const env = {
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  app: {
    name: raw.APP_NAME,
    url: raw.APP_URL,
    apiUrl: raw.API_URL,
    dashboardUrl: raw.DASHBOARD_URL,
    widgetUrl: raw.WIDGET_URL,
  },
  corsOrigins: list(raw.CORS_ORIGINS).length
    ? list(raw.CORS_ORIGINS)
    : [raw.DASHBOARD_URL, raw.WIDGET_URL],
  trustProxy: raw.TRUST_PROXY,
  mongo: { uri: raw.MONGO_URI, debug: raw.MONGO_DEBUG },
  redis: { url: raw.REDIS_URL, prefix: raw.REDIS_PREFIX, disabled: raw.REDIS_DISABLED },
  jwt: {
    accessSecret: raw.JWT_ACCESS_SECRET,
    refreshSecret: raw.JWT_REFRESH_SECRET,
    widgetSecret: raw.JWT_WIDGET_SECRET,
    accessExpiresIn: raw.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: raw.JWT_REFRESH_EXPIRES_IN,
    widgetExpiresIn: raw.JWT_WIDGET_EXPIRES_IN,
  },
  tokens: {
    emailVerificationExpiresIn: raw.EMAIL_TOKEN_EXPIRES_IN,
    passwordResetExpiresIn: raw.PASSWORD_RESET_EXPIRES_IN,
    invitationExpiresIn: raw.INVITATION_EXPIRES_IN,
  },
  cookies: {
    refreshEnabled: raw.REFRESH_COOKIE_ENABLED,
    refreshName: raw.REFRESH_COOKIE_NAME,
    domain: raw.COOKIE_DOMAIN || undefined,
  },
  mail: {
    driver: raw.MAIL_DRIVER,
    from: raw.SMTP_FROM,
    smtp: {
      host: raw.SMTP_HOST,
      port: raw.SMTP_PORT,
      secure: raw.SMTP_SECURE,
      user: raw.SMTP_USER,
      password: raw.SMTP_PASSWORD,
    },
  },
  storage: {
    driver: raw.STORAGE_DRIVER,
    uploadDir: path.resolve(process.cwd(), raw.UPLOAD_DIR),
    maxFileSize: raw.MAX_FILE_SIZE,
    s3: {
      endpoint: raw.S3_ENDPOINT,
      region: raw.S3_REGION,
      bucket: raw.S3_BUCKET,
      accessKeyId: raw.S3_ACCESS_KEY_ID,
      secretAccessKey: raw.S3_SECRET_ACCESS_KEY,
      publicBaseUrl: raw.S3_PUBLIC_BASE_URL,
      forcePathStyle: raw.S3_FORCE_PATH_STYLE,
    },
  },
  rateLimit: {
    windowMs: raw.RATE_LIMIT_WINDOW_MS,
    max: raw.RATE_LIMIT_MAX,
    authWindowMs: raw.AUTH_RATE_LIMIT_WINDOW_MS,
    authMax: raw.AUTH_RATE_LIMIT_MAX,
    publicWindowMs: raw.PUBLIC_RATE_LIMIT_WINDOW_MS,
    publicMax: raw.PUBLIC_RATE_LIMIT_MAX,
    bodyLimit: raw.BODY_LIMIT,
  },
  cache: { widgetConfigTtl: raw.WIDGET_CONFIG_CACHE_TTL },
  presence: { ttl: raw.PRESENCE_TTL },
  workers: { concurrency: raw.WORKER_CONCURRENCY, scheduledJobs: raw.ENABLE_SCHEDULED_JOBS },
  log: { level: raw.LOG_LEVEL, pretty: raw.LOG_PRETTY },
  seed: {
    superAdminEmail: process.env.SEED_SUPER_ADMIN_EMAIL,
    superAdminPassword: process.env.SEED_SUPER_ADMIN_PASSWORD,
    superAdminName: process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin',
    demo: String(process.env.SEED_DEMO || 'false') === 'true',
    ownerEmail: process.env.SEED_OWNER_EMAIL,
    ownerPassword: process.env.SEED_OWNER_PASSWORD,
    agentEmail: process.env.SEED_AGENT_EMAIL,
    agentPassword: process.env.SEED_AGENT_PASSWORD,
  },
};

module.exports = env;
