const { Server } = require("socket.io");
const { createAdapter } = require("@socket.io/redis-adapter");

// Configs
const redis = require("./redis");

let io = null;

exports.createSocketServer = (httpServer) => {
  if (io) {
    return io;
  }

  io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: true,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
    transports: ["websocket", "polling"],
  });

  if (redis.isRedisEnabled()) {
    const pubClient = redis.getRedis("socket-pub");
    const subClient = redis.getRedis("socket-sub");

    io.adapter(
      createAdapter(pubClient, subClient, {
        key: redis.redisKey("sio"),
      }),
    );
    console.log("Socket.IO Redis adapter attached".bgGreen.black);
  } else {
    console.log("Socket.IO running without Redis adapter (single instance only)".bgYellow.black);
  }

  return io;
};

exports.getIO = () => {
  return io;
};

exports.closeSocketServer = async () => {
  if (!io) {
    return;
  }

  const socketServer = io;
  io = null;

  await new Promise((resolve, reject) => {
    socketServer.close((error) => {
      if (error) {
        return reject(error);
      }

      resolve();
    });
  });

  console.log("Socket closed".bgGreen.white);
};
