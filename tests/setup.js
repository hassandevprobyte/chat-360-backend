'use strict';

/**
 * Jest setup: an in-memory MongoDB, Redis disabled (MemoryRedis stub), mail in
 * log mode. Every test file gets a clean database; no external services.
 */
process.env.NODE_ENV = 'test';
process.env.REDIS_DISABLED = 'true';
process.env.MAIL_DRIVER = 'log';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-0123456789';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-0123456789';
process.env.JWT_WIDGET_SECRET = process.env.JWT_WIDGET_SECRET || 'test-widget-secret-0123456789';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/placeholder';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || './storage/test-uploads';

const path = require('path');
const fs = require('fs');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

/**
 * TEST_MONGO_URI lets CI (or an environment without internet access for the
 * memory-server binary download) point the suite at a real MongoDB instead.
 */
beforeAll(async () => {
  let uri = process.env.TEST_MONGO_URI;
  if (!uri) {
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri('livechat_test');
  }
  const { connectDatabase } = require('../src/config/database');
  await connectDatabase(uri);
});

afterEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
  fs.rmSync(path.resolve(process.cwd(), process.env.UPLOAD_DIR), { recursive: true, force: true });
});
