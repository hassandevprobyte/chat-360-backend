// Configs
const { createSocketServer } = require("../config/socket");

// Realtime
const { socketAuth } = require("./auth");
const emitters = require("./emitters");

const initRealtime = async (httpServer) => {
  const io = createSocketServer(httpServer);
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const type = socket.data.type;
    console.log({ socketId: socket.id, type }, "Socket connected".bgGreen.black);

    socket.on("error", (err) => console.log({ err, socketId: socket.id }, "Socket error".bgRed.black));
  });

  await emitters.subscribeBridge();
  return io;
};

module.exports = initRealtime;
