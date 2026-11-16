'use strict';

const { Worker } = require('bullmq');
const env = require('../../config/env');
const { getRedis, isRedisDisabled } = require('../../config/redis');
const logger = require('../../common/logger');
const { QUEUE_NAMES } = require('../../common/constants');
const { processEmailJob } = require('../processors/email.processor');
const { processNotificationJob } = require('../processors/notification.processor');
const { processCleanupJob } = require('../processors/cleanup.processor');

const workers = [];

const PROCESSORS = {
  [QUEUE_NAMES.EMAIL]: { processor: processEmailJob, concurrency: env.workers.concurrency },
  [QUEUE_NAMES.NOTIFICATIONS]: { processor: processNotificationJob, concurrency: env.workers.concurrency },
  [QUEUE_NAMES.CLEANUP]: { processor: processCleanupJob, concurrency: 1 },
};

/**
 * Starts one BullMQ worker per queue. Runs in its own process (src/worker.js)
 * so heavy jobs never compete with request handling; `which` lets a deployment
 * dedicate processes to specific queues.
 */
function startWorkers({ which = Object.keys(PROCESSORS) } = {}) {
  if (isRedisDisabled()) {
    logger.warn('Workers not started: Redis is disabled');
    return [];
  }

  which.forEach((name) => {
    const { processor, concurrency } = PROCESSORS[name];
    const worker = new Worker(name, processor, {
      connection: getRedis('bullmq'),
      prefix: `${env.redis.prefix}:bull`,
      concurrency,
      // Delayed/repeat scheduling requires the worker to run the scheduler.
      autorun: true,
    });

    worker.on('completed', (job) => logger.debug({ queue: name, jobId: job.id }, 'Job completed'));
    worker.on('failed', (job, err) =>
      logger.error({ queue: name, jobId: job && job.id, attempts: job && job.attemptsMade, err }, 'Job failed'));
    worker.on('error', (err) => logger.error({ queue: name, err }, 'Worker error'));

    workers.push(worker);
    logger.info({ queue: name, concurrency }, 'Worker started');
  });

  return workers;
}

async function stopWorkers() {
  await Promise.all(workers.map((w) => w.close().catch(() => {})));
  workers.length = 0;
}

module.exports = { startWorkers, stopWorkers, PROCESSORS };
