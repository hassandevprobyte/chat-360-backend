require("colors");
const http = require("http");

const createApp = require("./app");
const bootstrap = require("./bootstrap");
const env = require("./config/env");
const backup = require("./config/backup");
const initRealtime = require("./realtime");
const shutdown = require("./common/utils/shutdown");
const worker = require("./jobs/workers");
const db = require("./config/db");
const redis = require("./config/redis");

const start = async () => {
  await db.connectDB();
  if (!redis.isRedisDisabled()) await redis.checkConnection();

  worker.createWorkers();

  await bootstrap();
  backup();

  const app = createApp();

  const server = http.createServer(app);

  await initRealtime(server);

  ["SIGINT", "SIGTERM", "unhandledRejection", "uncaughtException"].forEach((event) => {
    process.on(event, (err) => {
      if (err) {
        console.error(event.bgRed.white, err);
      }

      shutdown(server, event);
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(env.PORT, () => {
      server.removeListener("error", reject);
      console.log(`Server listening on port ${env.PORT}`.bgWhite.black);
      resolve();
    });
  });

  return server;
};

if (require.main === module) {
  start().catch((err) => {
    console.error("Failed to start API".bgRed.white, err);
    process.exit(1);
  });
}

module.exports = { start };
