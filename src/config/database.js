'use strict';

const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../common/logger');

mongoose.set('strictQuery', true);
// Operator injection is prevented one layer up: every request body/query is
// validated and stripped by Joi before it reaches a service, and repositories
// build their own filters. Mongoose's global sanitizeFilter would also rewrite
// the legitimate `$in`/`$ne` predicates the repositories rely on, so it is
// intentionally left off.
mongoose.set('sanitizeFilter', false);

if (env.mongo.debug) {
  mongoose.set('debug', true);
}

let connectingPromise = null;

async function connectDatabase(uri = env.mongo.uri) {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectingPromise) return connectingPromise;

  connectingPromise = mongoose
    .connect(uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    })
    .then((m) => {
      logger.info({ host: m.connection.host, db: m.connection.name }, 'MongoDB connected');
      return m.connection;
    })
    .catch((err) => {
      connectingPromise = null;
      logger.error({ err }, 'MongoDB connection failed');
      throw err;
    });

  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));

  return connectingPromise;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  connectingPromise = null;
  logger.info('MongoDB disconnected');
}

/**
 * Transactions require a replica set. In single-node dev setups we fall back to
 * running the callback without a session so the app keeps working.
 */
async function withTransaction(fn) {
  let session;
  try {
    session = await mongoose.startSession();
  } catch (err) {
    return fn(null);
  }
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (err) {
    if (err && /Transaction numbers are only allowed|not supported|replica set|autocommit|transactions are not/i.test(err.message || '')) {
      return fn(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

module.exports = { connectDatabase, disconnectDatabase, withTransaction, mongoose };
