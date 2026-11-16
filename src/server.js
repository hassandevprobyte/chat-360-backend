"use strict";

const http = require("http");
const env = require("./config/env");
const logger = require("./common/logger");
const { connectDatabase, disconnectDatabase } = require("./config/database");
const { getRedis, closeRedis, isRedisDisabled } = require("./config/redis");
const { closeSocketServer } = require("./config/socket");
const { closeQueues } = require("./jobs/queues");
const { createApp } = require("./app");
const { initRealtime } = require("./realtime");

/**
 * API process: HTTP + Socket.IO on one port. Background jobs run in
 * src/worker.js; the API only enqueues.
 */
async function start() {
  await connectDatabase();
  if (!isRedisDisabled()) await getRedis().ping();

  const app = createApp();
  const server = http.createServer(app);
  await initRealtime(server);

  await new Promise((resolve) => server.listen(env.port, resolve));
  logger.info({ port: env.port, env: env.nodeEnv }, `${env.app.name} API listening`);

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");

    const timer = setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 15000).unref();

    await new Promise((resolve) => server.close(resolve));
    await closeSocketServer();
    await closeQueues();
    await closeRedis();
    await disconnectDatabase();
    clearTimeout(timer);
    logger.info("Shutdown complete");
    process.exit(0);
  };

  ["SIGINT", "SIGTERM"].forEach((sig) => process.on(sig, () => shutdown(sig)));
  process.on("unhandledRejection", (err) => logger.error({ err }, "Unhandled rejection"));
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    shutdown("uncaughtException");
  });

  return server;
}

if (require.main === module) {
  start().catch((err) => {
    logger.fatal({ err }, "Failed to start API");
    process.exit(1);
  });
}

module.exports = { start };
