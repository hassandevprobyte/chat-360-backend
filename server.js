require("colors");
const http = require("http");
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const cookieParser = require("cookie-parser");
const compression = require("compression");

const app = express();

const { errorHandler } = require("./middleware/errorHandler");
const bootstrap = require("./bootstrap");
const { corsOptions, env } = require("./config");
const backup = require("./config/backup");
const pagination = require("./middleware/pagination");
const requestLogger = require("./middleware/requestLogger");
const initRealtime = require("./realtime");
const shutdown = require("./common/utils/shutdown");

// app.use(helmet());

app.use(cors(corsOptions));

app.use(compression());

app.use(requestLogger);

app.use(express.json({ limit: env.BODY.LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.BODY.LIMIT }));

app.use(cookieParser());

app.use(mongoSanitize());

app.use(pagination);
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/api/v1", require("./modules"));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

const start = async () => {
  await bootstrap();
  backup();

  const server = http.createServer(app);

  initRealtime(server);

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
