const socketIO = require("socket.io");

let io;

module.exports = {
  init: function (httpServer) {
    io = socketIO(httpServer, {
      cors: {
        origin: "*", // Cho phép tất cả các nguồn
        methods: ["GET", "POST"],
        credentials: true
      },
    });

    io.on("connection", (socket) => {
      console.log("Một người dùng đã kết nối");

      socket.on("sendMessage", (message) => {
        // Phát tin nhắn đến người dùng khác
        socket.broadcast.emit("receiveMessage", message);
      });

      socket.on("disconnect", () => {
        console.log("Một người dùng đã ngắt kết nối");
      });
    });

    return io;
  },
  getIO: function () {
    if (!io) {
      throw new Error("Socket.io chưa được khởi tạo!");
    }
    return io;
  },
};
