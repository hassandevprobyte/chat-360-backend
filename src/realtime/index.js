'use strict';

const logger = require('../common/logger');
const { createSocketServer } = require('../config/socket');
const { socketAuth } = require('./auth');
const { subscribeBridge } = require('./emitter');
const { SOCKET_TYPES } = require('./events');
const { registerDashboardHandlers } = require('./handlers/dashboard');
const { registerWidgetHandlers } = require('./handlers/widget');

/**
 * Boots Socket.IO on the existing HTTP server and wires the two socket kinds.
 * Called once by server.js; workers never call this.
 */
async function initRealtime(httpServer) {
  const io = createSocketServer(httpServer);
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const type = socket.data.type;
    logger.debug({ socketId: socket.id, type }, 'Socket connected');

    if (type === SOCKET_TYPES.WIDGET) registerWidgetHandlers(io, socket);
    else registerDashboardHandlers(io, socket);

    socket.on('error', (err) => logger.warn({ err, socketId: socket.id }, 'Socket error'));
  });

  await subscribeBridge();
  return io;
}

module.exports = { initRealtime };
