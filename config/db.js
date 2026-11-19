const mongoose = require("mongoose");

// Environment variables
const env = require("./env");

mongoose.set("strictQuery", "throw");

let connectionPromise = null;

exports.connectDB = async (uri = env.MONGODB_URI) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise.then((database) => database.connection);
  }

  connectionPromise = mongoose.connect(uri, {
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  try {
    const database = await connectionPromise;

    console.log(`Connected to database ${database.connection.host}`.bgGreen.white);

    return database;
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  } finally {
    connectionPromise = null;
  }
};

exports.disconnectDB = async () => {
  try {
    if (connectionPromise) {
      await connectionPromise;
    }

    if (mongoose.connection.readyState === 0) {
      return;
    }

    await mongoose.disconnect();

    console.log("Database Disconnected".bgGreen.white);
  } catch (error) {
    console.error("Database disconnection failed:", error);
    throw error;
  } finally {
    connectionPromise = null;
  }
};

exports.withTransaction = async (fn) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await fn(session);
    });

    return result;
  } catch (error) {
    console.error("Transaction failed:", error);
    throw error;
  } finally {
    await session.endSession();
  }
};
