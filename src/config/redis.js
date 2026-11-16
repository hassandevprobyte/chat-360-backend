'use strict';

const Redis = require('ioredis');
const env = require('./env');
const logger = require('../common/logger');

/**
 * Minimal in-process Redis stand-in.
 *
 * Only used when REDIS_DISABLED=true (isolated test runs / quick local boots).
 * Redis is a hard requirement in production - this stub exists so the test
 * suite does not need a Redis container, not as an alternative architecture.
 */
class MemoryRedis {
  constructor() {
    this.store = new Map();
    this.sets = new Map();
    this.hashes = new Map();
    this.timers = new Map();
    this.subscribers = new Map();
    this.status = 'ready';
    this.isMemory = true;
  }

  _expire(key, seconds) {
    clearTimeout(this.timers.get(key));
    if (!seconds) return;
    const t = setTimeout(() => {
      this.store.delete(key);
      this.sets.delete(key);
      this.hashes.delete(key);
      this.timers.delete(key);
    }, seconds * 1000);
    if (t.unref) t.unref();
    this.timers.set(key, t);
  }

  async get(key) { return this.store.has(key) ? this.store.get(key) : null; }

  async set(key, value, ...args) {
    const flags = args.map((a) => String(a).toUpperCase());
    if (flags.includes('NX') && this.store.has(key)) return null;
    this.store.set(key, String(value));
    const exIdx = flags.indexOf('EX');
    if (exIdx > -1) this._expire(key, Number(args[exIdx + 1]));
    return 'OK';
  }

  async setex(key, seconds, value) { return this.set(key, value, 'EX', seconds); }
  async del(...keys) {
    const flat = keys.flat();
    let n = 0;
    flat.forEach((k) => {
      if (this.store.delete(k) || this.sets.delete(k) || this.hashes.delete(k)) n += 1;
    });
    return n;
  }

  async exists(key) { return this.store.has(key) || this.sets.has(key) || this.hashes.has(key) ? 1 : 0; }
  async expire(key, seconds) { this._expire(key, seconds); return 1; }
  async ttl(key) { return this.timers.has(key) ? 60 : -1; }
  async incr(key) {
    const v = Number(this.store.get(key) || 0) + 1;
    this.store.set(key, String(v));
    return v;
  }

  async mget(...keys) {
    const flat = keys.flat();
    return flat.map((k) => (this.store.has(k) ? this.store.get(k) : null));
  }

  async keys(pattern) {
    const rx = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    return [...this.store.keys(), ...this.sets.keys(), ...this.hashes.keys()].filter((k) => rx.test(k));
  }

  async sadd(key, ...members) {
    const set = this.sets.get(key) || new Set();
    members.flat().forEach((m) => set.add(String(m)));
    this.sets.set(key, set);
    return members.length;
  }

  async srem(key, ...members) {
    const set = this.sets.get(key);
    if (!set) return 0;
    members.flat().forEach((m) => set.delete(String(m)));
    return 1;
  }

  async smembers(key) { return [...(this.sets.get(key) || [])]; }
  async scard(key) { return (this.sets.get(key) || new Set()).size; }

  async hset(key, ...args) {
    const hash = this.hashes.get(key) || new Map();
    if (args.length === 1 && typeof args[0] === 'object') {
      Object.entries(args[0]).forEach(([k, v]) => hash.set(k, String(v)));
    } else {
      for (let i = 0; i < args.length; i += 2) hash.set(String(args[i]), String(args[i + 1]));
    }
    this.hashes.set(key, hash);
    return 1;
  }

  async hget(key, field) {
    const hash = this.hashes.get(key);
    return hash && hash.has(field) ? hash.get(field) : null;
  }

  async hgetall(key) { return Object.fromEntries(this.hashes.get(key) || new Map()); }
  async hdel(key, ...fields) {
    const hash = this.hashes.get(key);
    if (hash) fields.flat().forEach((f) => hash.delete(f));
    return 1;
  }

  async publish(channel, message) {
    (this.subscribers.get(channel) || []).forEach((cb) => setImmediate(() => cb(channel, message)));
    return 1;
  }

  async subscribe(channel) {
    if (!this.subscribers.has(channel)) this.subscribers.set(channel, []);
    return 1;
  }

  on(event, cb) {
    if (event === 'message') {
      this.subscribers.forEach((list) => list.push(cb));
      this._pendingMessageCb = cb;
    }
    return this;
  }

  duplicate() { return this; }
  async ping() { return 'PONG'; }
  async quit() { this.timers.forEach((t) => clearTimeout(t)); return 'OK'; }
  disconnect() { this.timers.forEach((t) => clearTimeout(t)); }
}

const connections = new Map();

function buildClient(name) {
  if (env.redis.disabled) return new MemoryRedis();

  const client = new Redis(env.redis.url, {
    maxRetriesPerRequest: name === 'bullmq' ? null : 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 200, 3000),
  });

  client.on('connect', () => logger.info({ client: name }, 'Redis connected'));
  client.on('error', (err) => logger.error({ err, client: name }, 'Redis error'));
  client.on('close', () => logger.warn({ client: name }, 'Redis connection closed'));
  return client;
}

/**
 * Named connections so we never mix pub/sub (which puts a connection in
 * subscriber mode) with normal command traffic, or with BullMQ's requirements.
 * Valid names: 'default' | 'subscriber' | 'publisher' | 'bullmq' | 'socket-pub' | 'socket-sub'
 */
function getRedis(name = 'default') {
  if (!connections.has(name)) connections.set(name, buildClient(name));
  return connections.get(name);
}

const key = (...parts) => [env.redis.prefix, ...parts].join(':');

async function closeRedis() {
  await Promise.all([...connections.values()].map((c) => c.quit().catch(() => c.disconnect())));
  connections.clear();
}

module.exports = { getRedis, closeRedis, key, MemoryRedis, isRedisDisabled: () => env.redis.disabled };
