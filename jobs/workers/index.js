const { Worker } = require("bullmq");

// Environment Variables
const env = require("../../config/env");

// Configs
const redis = require("../../config/redis");

// Constants
const { QUEUE_NAMES } = require("../../common/constants");

const workers = new Map();

exports.PROCESSORS = {
  [QUEUE_NAMES.EMAIL]: {
    processor: () => {
      return true;
    },
    concurrency: env.WORKER.CONCURRENCY,
  },
  [QUEUE_NAMES.NOTIFICATIONS]: {
    processor: () => {
      return true;
    },
    concurrency: env.WORKER.CONCURRENCY,
  },
  [QUEUE_NAMES.CLEANUP]: {
    processor: () => {
      return true;
    },
    concurrency: 1,
  },
};

exports.createWorkers = ({ which = Object.keys(exports.PROCESSORS) } = {}) => {
  if (!redis.isRedisEnabled()) {
    console.log("Workers not started: Redis is unavailable".bgRed.white);
    return [];
  }

  const startedWorkers = [];

  which.forEach((name) => {
    if (workers.has(name)) {
      startedWorkers.push(workers.get(name));
      return;
    }

    const config = exports.PROCESSORS[name];

    if (!config) {
      console.log(`Worker configuration not found: ${name}`);
      return;
    }

    const { processor, concurrency } = config;

    const worker = new Worker(name, processor, {
      connection: redis.getRedis("workers"),
      prefix: `${redis.redisKey("workers")}`,
      concurrency,
    });

    worker.on("completed", (job) => {
      console.log({ queue: name, jobId: job.id }, "Job completed");
    });

    worker.on("failed", (job, err) => {
      console.log(
        {
          queue: name,
          jobId: job?.id,
          attempts: job?.attemptsMade,
          err,
        },
        "Job failed",
      );
    });

    worker.on("error", (err) => {
      console.log({ queue: name, err }, "Worker error");
    });

    workers.set(name, worker);
    startedWorkers.push(worker);

    console.log(`${name} Worker started`.bgGreen.white);
  });

  return startedWorkers;
};

exports.closeWorkers = async (workerNames = []) => {
  const names = workerNames.length ? workerNames : [...workers.keys()];

  await Promise.all(
    names.map(async (name) => {
      const worker = workers.get(name);

      if (!worker) return;

      await worker.close();
      workers.delete(name);
    }),
  );

  console.log("Worker Closed".bgGreen.white);
};

exports.getWorkers = (workerNames = []) => {
  if (!workerNames.length) {
    return [...workers.values()];
  }

  return workerNames.map((name) => workers.get(name)).filter(Boolean);
};
