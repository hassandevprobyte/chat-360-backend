const Boom = require("@hapi/boom");
const { Queue } = require("bullmq");

// Config
const redis = require("../../config/redis");

// Environment Variables
const { env } = require("../../config");

const queues = new Map();

const DEFAULT_OPTIONS = {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: false,
  },
};

exports.QUEUE_STATUS = ["waiting", "active", "completed", "failed", "delayed", "paused"];

exports.getQueue = (queueName) => {
  if (!queueName) {
    throw Boom.badRequest("Queue name is required");
  }

  if (redis.isRedisDisabled()) {
    throw Boom.serverUnavailable("Redis is unavailable");
  }

  if (!queues.has(queueName)) {
    const queue = new Queue(queueName, {
      ...DEFAULT_OPTIONS,
      connection: redis.getRedis("queues"),
      prefix: `${redis.redisKey("queues")}`,
    });

    queues.set(queueName, queue);
  }

  return queues.get(queueName);
};

exports.getJob = (queueName, jobId) => {
  const queue = exports.getQueue(queueName);

  return queue.getJob(jobId);
};

exports.getQueueCounts = (queueName) => {
  const queue = exports.getQueue(queueName);

  return queue.getJobCounts(...exports.QUEUE_STATUS);
};

exports.enqueue = (queueName, jobName, payload = {}, options = {}) => {
  const queue = exports.getQueue(queueName);

  return queue.add(jobName, { payload }, options);
};

exports.dequeue = async (queueName, jobId) => {
  const queue = exports.getQueue(queueName);
  const job = await queue.getJob(jobId);

  if (!job) {
    throw Boom.notFound("Job not found");
  }

  return job.remove();
};

exports.pauseQueues = async (queueNames = []) => {
  await Promise.all(queueNames.map((queueName) => exports.getQueue(queueName).pause()));
};

exports.resumeQueues = async (queueNames = []) => {
  await Promise.all(queueNames.map((queueName) => exports.getQueue(queueName).resume()));
};

exports.closeQueues = async (queueNames = []) => {
  const names = queueNames.length ? queueNames : [...queues.keys()];

  await Promise.all(
    names.map(async (queueName) => {
      const queue = queues.get(queueName);

      if (!queue) return;

      await queue.close();
      queues.delete(queueName);
    }),
  );

  console.log("Queue Closed".bgGreen.white);
};
