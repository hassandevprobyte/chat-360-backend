'use strict';

const { Queue } = require('bullmq');
const env = require('../../config/env');
const { getRedis, isRedisDisabled } = require('../../config/redis');
const logger = require('../../common/logger');
const { QUEUE_NAMES, JOB_NAMES } = require('../../common/constants');

const queues = new Map();

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 86400, count: 5000 },
};

const PER_QUEUE_OPTIONS = {
  [QUEUE_NAMES.EMAIL]: { attempts: 5 },
  [QUEUE_NAMES.NOTIFICATIONS]: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
  [QUEUE_NAMES.CLEANUP]: { attempts: 1 },
};

function getQueue(name) {
  if (isRedisDisabled()) return null;
  if (!queues.has(name)) {
    const queue = new Queue(name, {
      connection: getRedis('bullmq'),
      prefix: `${env.redis.prefix}:bull`,
      defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...(PER_QUEUE_OPTIONS[name] || {}) },
    });
    queue.on('error', (err) => logger.error({ err, queue: name }, 'Queue error'));
    queues.set(name, queue);
  }
  return queues.get(name);
}

/**
 * Enqueues a job. Never throws into a request: a failed enqueue is logged and
 * the HTTP response still succeeds, because queued work is always side work.
 * Chat delivery never goes through a queue.
 */
async function enqueue(queueName, jobName, data = {}, options = {}) {
  const queue = getQueue(queueName);
  if (!queue) {
    logger.debug({ queueName, jobName }, 'Queue disabled - job skipped');
    return null;
  }
  try {
    const job = await queue.add(jobName, data, options);
    logger.debug({ queueName, jobName, jobId: job.id }, 'Job enqueued');
    return job;
  } catch (err) {
    logger.error({ err, queueName, jobName }, 'Failed to enqueue job');
    return null;
  }
}

/** Repeatable maintenance jobs. Registered once, by the worker process only. */
async function registerScheduledJobs() {
  if (isRedisDisabled() || !env.workers.scheduledJobs) return;

  const cleanup = getQueue(QUEUE_NAMES.CLEANUP);

  await cleanup.add(
    JOB_NAMES.CLEANUP_EXPIRED_SESSIONS,
    {},
    { repeat: { pattern: '0 * * * *' }, jobId: 'repeat:cleanup-sessions' },
  );
  await cleanup.add(
    JOB_NAMES.CLEANUP_STALE_VISITORS,
    {},
    { repeat: { pattern: '*/10 * * * *' }, jobId: 'repeat:cleanup-visitors' },
  );
  await cleanup.add(
    JOB_NAMES.CLEANUP_EXPIRED_INVITATIONS,
    {},
    { repeat: { pattern: '30 * * * *' }, jobId: 'repeat:cleanup-invitations' },
  );

  logger.info('Scheduled jobs registered');
}

async function closeQueues() {
  await Promise.all([...queues.values()].map((q) => q.close().catch(() => {})));
  queues.clear();
}

module.exports = { QUEUE_NAMES, JOB_NAMES, getQueue, enqueue, registerScheduledJobs, closeQueues };
