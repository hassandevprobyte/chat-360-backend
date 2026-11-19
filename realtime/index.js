// Configs
const { createSocketServer } = require("../config/socket");

// Realtime
const socketAuth = require("./socketAuth");

const initRealtime = (httpServer) => {
  const io = createSocketServer(httpServer);
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const type = socket.data.type;
    console.log({ socketId: socket.id, type }, "Socket connected".bgGreen.black);

    socket.on("error", (err) => console.log({ err, socketId: socket.id }, "Socket error".bgRed.black));
  });

  return io;
};

module.exports = initRealtime;
