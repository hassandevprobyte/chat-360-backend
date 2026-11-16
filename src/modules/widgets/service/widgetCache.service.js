'use strict';

const env = require('../../../config/env');
const { getRedis, key } = require('../../../config/redis');
const logger = require('../../../common/logger');
const widgetRepository = require('../repository/widget.repository');

/** widget:config:{publicKey} - read on every widget bootstrap. */
const cacheKey = (publicKey) => key('widget', 'config', publicKey);

async function get(publicKey) {
  try {
    const raw = await getRedis().get(cacheKey(publicKey));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn({ err, publicKey }, 'Widget config cache read failed');
    return null;
  }
}

async function set(publicKey, payload, ttl = env.cache.widgetConfigTtl) {
  try {
    await getRedis().set(cacheKey(publicKey), JSON.stringify(payload), 'EX', ttl);
  } catch (err) {
    logger.warn({ err, publicKey }, 'Widget config cache write failed');
  }
}

async function invalidate(publicKey) {
  if (!publicKey) return;
  try {
    await getRedis().del(cacheKey(publicKey));
    logger.debug({ publicKey }, 'Widget config cache invalidated');
  } catch (err) {
    logger.warn({ err, publicKey }, 'Widget config cache invalidation failed');
  }
}

/** A website's origin rules feed the widget config, so both must be flushed together. */
async function invalidateForWebsite(workspaceId, websiteId) {
  const publicKeys = await widgetRepository.listPublicKeysForWebsite(workspaceId, websiteId);
  await Promise.all(publicKeys.map(invalidate));
}

module.exports = { cacheKey, get, set, invalidate, invalidateForWebsite };
