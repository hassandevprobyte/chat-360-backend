const IORedis = require("ioredis");

// Environment Variables
const env = require("./env");

const DEFAULT_OPTIONS = {
  maxRetriesPerRequest: null,
};

const connections = new Map();

exports.getRedis = (connectionName = "default") => {
  if (connections.has(connectionName)) {
    return connections.get(connectionName);
  }

  const connection = new IORedis(env.REDIS.URL, {
    ...DEFAULT_OPTIONS,
    connectionName,
  });

  connections.set(connectionName, connection);

  return connection;
};

exports.isRedisDisabled = () => {
  return env.REDIS.DISABLED;
};

exports.checkConnection = async (connectionName = "default") => {
  try {
    return (await exports.getRedis(connectionName).ping()) === "PONG";
  } catch (error) {
    console.log("Redis connection is unavailable".bgRed.white);
    return false;
  }
};

exports.closeRedisConnection = async (connectionNames = []) => {
  const names = connectionNames.length ? connectionNames : [...connections.keys()];

  await Promise.all(
    names.map(async (name) => {
      const connection = connections.get(name);

      if (!connection) return;

      await connection.quit();
      connections.delete(name);
    }),
  );

  console.log("Redis Closed".bgGreen.white);
};

exports.redisKey = (...parts) => {
  return [env.REDIS.PREFIX, ...parts].join(":");
};

exports.getKey = async ({ connectionName = "default", key }) => {
  const value = await exports.getRedis(connectionName).get(key);
  return value === null ? null : JSON.parse(value);
};

exports.getTtl = async ({ connectionName = "default", key }) => {
  return exports.getRedis(connectionName).ttl(key);
};

exports.setKey = async ({ connectionName = "default", key, value, expiresIn }) => {
  const serialized = JSON.stringify(value);

  return expiresIn ? exports.getRedis(connectionName).set(key, serialized, "EX", expiresIn) : exports.getRedis(connectionName).set(key, serialized);
};

exports.deleteKey = async ({ connectionName = "default", key }) => {
  return exports.getRedis(connectionName).del(key);
};
