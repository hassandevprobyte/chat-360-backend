const dotenv = require("dotenv");
dotenv.config();
const Joi = require("./joi");

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().default(5000),
  APP_NAME: Joi.string().default("chat360"),
  API_URL: Joi.string().uri().required(),
  APP_URL: Joi.string().uri().required(),
  WIDGET_URL: Joi.string().uri().required(),
  MONGODB_URI: Joi.string().uri().required(),

  REDIS_URL: Joi.string().uri().required(),
  REDIS_PREFIX: Joi.string().required(),
  REDIS_DISABLED: Joi.boolean().truthy("true", "1").falsy("false", "0").default(false),

  JWT_ACCESS_TOKEN_SECRET: Joi.string().required(),
  JWT_ACCESS_TOKEN_EXPIRES_IN: Joi.string().required(),
  JWT_REFRESH_TOKEN_SECRET: Joi.string().required(),
  JWT_REFRESH_TOKEN_EXPIRES_IN: Joi.string().required(),

  ENCRYPTION_KEY: Joi.string().required(),

  OTP_SECRET: Joi.string().required(),
  OTP_LENGTH: Joi.number().integer().min(4).max(10).default(6),
  OTP_MAX_ATTEMPTS: Joi.number().integer().max(3).default(3),
  OTP_MAX_RESEND_ATTEMPTS: Joi.number().integer().max(3).default(3),
  OTP_EXPIRY_MINUTES: Joi.number().integer().min(1).default(5),
  OTP_COOLDOWN_MINUTES: Joi.number().integer().min(1).default(1),

  WORKSPACE_SLUG_LENGTH: Joi.number().integer().min(4).default(10),

  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().email().required(),
  SMTP_PASSWORD: Joi.string().required(),

  RATE_LIMIT_WINDOW_MS: Joi.number().integer().default(60000),
  RATE_LIMIT_MAX: Joi.number().integer().default(300),
  AUTH_RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  AUTH_RATE_LIMIT_MAX: Joi.number().integer().default(20),
  PUBLIC_RATE_LIMIT_WINDOW_MS: Joi.number().integer().default(60000),
  PUBLIC_RATE_LIMIT_MAX: Joi.number().integer().default(120),
  VISITOR_RATE_LIMIT_WINDOW_MS: Joi.number().integer().default(60000),
  VISITOR_RATE_LIMIT_MAX: Joi.number().integer().default(40),
  UPLOAD_RATE_LIMIT_WINDOW_MS: Joi.number().integer().default(60000),
  UPLOAD_RATE_LIMIT_MAX: Joi.number().integer().default(20),

  BODY_LIMIT: Joi.string().default("100kb"),

  WORKER_CONCURRENCY: Joi.number().default(1),
}).unknown(true);

const { value: envVars, error } = envSchema.prefs({ errors: { label: "key" } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const env = {
  NODE_ENV: envVars.NODE_ENV,
  PORT: envVars.PORT,
  APP_NAME: envVars.APP_NAME,
  API_URL: envVars.API_URL,
  APP_URL: envVars.APP_URL,
  WIDGET_URL: envVars.WIDGET_URL,
  MONGODB_URI: envVars.MONGODB_URI,
  REDIS: {
    URL: envVars.REDIS_URL,
    PREFIX: envVars.REDIS_PREFIX,
    DISABLED: envVars.REDIS_DISABLED,
  },
  JWT: {
    ACCESS_TOKEN_SECRET: envVars.JWT_ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRES_IN: envVars.JWT_ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_SECRET: envVars.JWT_REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRES_IN: envVars.JWT_REFRESH_TOKEN_EXPIRES_IN,
  },
  ENCRYPTION_KEY: envVars.ENCRYPTION_KEY,
  OTP: {
    SECRET: envVars.OTP_SECRET,
    LENGTH: envVars.OTP_LENGTH,
    MAX_ATTEMPTS: envVars.OTP_MAX_ATTEMPTS,
    MAX_RESEND_ATTEMPTS: envVars.OTP_MAX_RESEND_ATTEMPTS,
    EXPIRY_MINUTES: envVars.OTP_EXPIRY_MINUTES,
    COOLDOWN_MINUTES: envVars.OTP_COOLDOWN_MINUTES,
  },
  WORKSPACE: {
    SLUG_LENGTH: envVars.WORKSPACE_SLUG_LENGTH,
  },
  SMTP: {
    HOST: envVars.SMTP_HOST,
    PORT: envVars.SMTP_PORT,
    USER: envVars.SMTP_USER,
    PASSWORD: envVars.SMTP_PASSWORD,
  },
  RATE_LIMIT: {
    WINDOW_MS: envVars.RATE_LIMIT_WINDOW_MS,
    MAX: envVars.RATE_LIMIT_MAX,
  },
  AUTH_RATE_LIMIT: {
    WINDOW_MS: envVars.AUTH_RATE_LIMIT_WINDOW_MS,
    MAX: envVars.AUTH_RATE_LIMIT_MAX,
  },
  PUBLIC_RATE_LIMIT: {
    WINDOW_MS: envVars.PUBLIC_RATE_LIMIT_WINDOW_MS,
    MAX: envVars.PUBLIC_RATE_LIMIT_MAX,
  },
  VISITOR_RATE_LIMIT: {
    WINDOW_MS: envVars.VISITOR_RATE_LIMIT_WINDOW_MS,
    MAX: envVars.VISITOR_RATE_LIMIT_MAX,
  },
  UPLOAD_RATE_LIMIT: {
    WINDOW_MS: envVars.UPLOAD_RATE_LIMIT_WINDOW_MS,
    MAX: envVars.UPLOAD_RATE_LIMIT_MAX,
  },
  BODY: {
    LIMIT: envVars.BODY_LIMIT,
  },
  WORKER: {
    CONCURRENCY: envVars.WORKER_CONCURRENCY,
  },
};

module.exports = env;
