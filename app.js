const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const mongoSanitize = require("express-mongo-sanitize");
const cookieParser = require("cookie-parser");
const compression = require("compression");

// Config
const { corsOptions, env } = require("./config");

// Middleware
const { errorHandler } = require("./middleware/errorHandler");
const pagination = require("./middleware/pagination");
const requestLogger = require("./middleware/requestLogger");

// Routes
const routes = require("./modules");

const createApp = () => {
  const app = express();

  // Application settings
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // Security
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(mongoSanitize());

  // Request processing
  app.use(compression());
  app.use(express.json({ limit: env.BODY.LIMIT }));
  app.use(express.urlencoded({ extended: false, limit: env.BODY.LIMIT }));
  app.use(cookieParser());

  // Logging
  app.use(requestLogger);

  // Static files
  app.use("/public", express.static(path.join(__dirname, "public")));

  // Common middleware
  app.use(pagination);

  // Health check
  app.get("/", (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        name: env.app.name,
        api: "/api/v1",
      },
    });
  });

  // API routes
  app.use("/api/v1", routes);

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
