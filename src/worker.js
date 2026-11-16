'use strict';

const env = require('./config/env');
const logger = require('./common/logger');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const { closeRedis, isRedisDisabled } = require('./config/redis');
const { registerScheduledJobs, closeQueues } = require('./jobs/queues');
const { startWorkers, stopWorkers } = require('./jobs/workers');

/**
 * Worker process. Consumes the BullMQ queues and owns the repeatable jobs.
 * Scale it independently of the API; several workers can run concurrently.
 */
async function start() {
  if (isRedisDisabled()) throw new Error('Workers require Redis (REDIS_DISABLED must be false)');

  await connectDatabase();
  await registerScheduledJobs();

  const which = process.env.WORKER_QUEUES ? process.env.WORKER_QUEUES.split(',').map((s) => s.trim()) : undefined;
  startWorkers(which ? { which } : {});
  logger.info({ env: env.nodeEnv, queues: which || 'all' }, 'Worker process ready');

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Worker shutting down');
    await stopWorkers();
    await closeQueues();
    await closeRedis();
    await disconnectDatabase();
    process.exit(0);
  };
  ['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
}

if (require.main === module) {
  start().catch((err) => {
    logger.fatal({ err }, 'Failed to start worker');
    process.exit(1);
  });
}

module.exports = { start };
