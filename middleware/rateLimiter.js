const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");

// Environment Variables
const env = require("../config/env");

// Configs
const redis = require("../config/redis");

if (!redis.isRedisEnabled()) {
  console.log("Rate limiting is using the in-memory store because Redis is unavailable".bgYellow.black);
}

const buildStore = (prefix) => {
  if (!redis.isRedisEnabled()) {
    return undefined;
  }

  const client = redis.getRedis("rate-limit");

  return new RedisStore({
    prefix: `${redis.redisKey("rate-limit", prefix)}:`,
    sendCommand: (command, ...args) => client.call(command, ...args),
  });
};

const handler = (req, res) => {
  res.status(429).json({
    message: "Too many requests. Please slow down.",
  });
};

exports.createLimiter = ({ windowMs, max, prefix, keyGenerator, skip = false }) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore(prefix),
    keyGenerator,
    handler,
    skip,
  });
};

exports.apiLimiter = exports.createLimiter({
  windowMs: env.RATE_LIMIT.WINDOW_MS,
  max: env.RATE_LIMIT.MAX,
  prefix: "api",
  keyGenerator: (req) => (req.user ? `u:${req.user.id}` : `ip:${ipKeyGenerator(req.ip)}`),
});

exports.authLimiter = exports.createLimiter({
  windowMs: env.AUTH_RATE_LIMIT.WINDOW_MS,
  max: env.AUTH_RATE_LIMIT.MAX,
  prefix: "auth",
  keyGenerator: (req) => {
    const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : "anon";

    return `${ipKeyGenerator(req.ip)}:${email}`;
  },
});

exports.publicLimiter = exports.createLimiter({
  windowMs: env.PUBLIC_RATE_LIMIT.WINDOW_MS,
  max: env.PUBLIC_RATE_LIMIT.MAX,
  prefix: "public",
  keyGenerator: (req) => {
    if (req.visitor) return `v:${req.visitor.id}`;
    if (req.params?.publicKey) return `w:${req.params.publicKey}:${ipKeyGenerator(req.ip)}`;

    return `ip:${ipKeyGenerator(req.ip)}`;
  },
});

exports.visitorMessageLimiter = exports.createLimiter({
  windowMs: env.VISITOR_RATE_LIMIT.WINDOW_MS,
  max: env.VISITOR_RATE_LIMIT.MAX,
  prefix: "visitor-msg",
  keyGenerator: (req) => (req.visitor ? `v:${req.visitor.id}` : `ip:${ipKeyGenerator(req.ip)}`),
});

exports.uploadLimiter = exports.createLimiter({
  windowMs: env.UPLOAD_RATE_LIMIT.WINDOW_MS,
  max: env.UPLOAD_RATE_LIMIT.MAX,
  prefix: "upload",
  keyGenerator: (req) => {
    if (req.user) return `u:${req.user.id}`;
    if (req.visitor) return `v:${req.visitor.id}`;

    return `ip:${ipKeyGenerator(req.ip)}`;
  },
});
