'use strict';

const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const env = require('./env');
const { getRedis, isRedisDisabled } = require('./redis');
const logger = require('../common/logger');

let io = null;

/**
 * Socket.IO is always attached to the existing HTTP server - never started as an
 * independent listener - so a single port, one CORS policy and one lifecycle.
 */
function createSocketServer(httpServer) {
  if (io) return io;

  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      // Widget sockets come from arbitrary customer domains; the handshake
      // itself is authenticated by a signed visitor token, and the visitor's
      // origin was already validated when that token was issued.
      origin: true,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
    transports: ['websocket', 'polling'],
  });

  if (!isRedisDisabled()) {
    const pubClient = getRedis('socket-pub');
    const subClient = getRedis('socket-sub');
    io.adapter(createAdapter(pubClient, subClient, { key: `${env.redis.prefix}:sio` }));
    logger.info('Socket.IO Redis adapter attached');
  } else {
    logger.warn('Socket.IO running without Redis adapter (single instance only)');
  }

  return io;
}

const getIO = () => io;

async function closeSocketServer() {
  if (!io) return;
  await new Promise((resolve) => io.close(resolve));
  io = null;
}

module.exports = { createSocketServer, getIO, closeSocketServer };
