// Configs
const { closeSocketServer } = require("../../config/socket");
const { disconnectDB } = require("../../config/db");
const { closeRedisConnection } = require("../../config/redis");

// Jobs
const { closeQueues } = require("../../jobs/queues");
const { closeWorkers } = require("../../jobs/workers");

let shuttingDown = false;

const closeHttpServer = (server) => {
  return new Promise((resolve, reject) => {
    if (!server?.listening) {
      return resolve();
    }

    server.close((error) => {
      if (error && error.code !== "ERR_SERVER_NOT_RUNNING") {
        return reject(error);
      }

      resolve();
    });
  });
};

const shutdown = async (server, signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  console.log(`Shutting down (${signal})...`.bgYellow.black);

  const timer = setTimeout(() => {
    console.error("Forced shutdown after timeout".bgRed.white);
    process.exit(1);
  }, 15000);

  let hasErrors = false;

  const cleanup = async (name, fn) => {
    try {
      await fn();
    } catch (error) {
      hasErrors = true;
      console.error(`Failed to close ${name}`.bgRed.white, error);
    }
  };

  try {
    await cleanup("Socket server", closeSocketServer);
    await cleanup("HTTP server", () => closeHttpServer(server));
    await cleanup("Workers", closeWorkers);
    await cleanup("Queues", closeQueues);
    await cleanup("Redis", closeRedisConnection);
    await cleanup("Database", disconnectDB);
  } finally {
    clearTimeout(timer);

    console.log(hasErrors ? "Shutdown completed with errors".bgYellow.white : "Shutdown complete".bgGreen.white);

    process.exit(hasErrors ? 1 : 0);
  }
};

module.exports = shutdown;
