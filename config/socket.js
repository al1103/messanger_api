const socketIO = require("socket.io");

// Lưu trữ mapping giữa userId và socketId
const userSocketMap = new Map();

function initializeSocket(server, corsOptions) {
  const io = socketIO(server, {
    cors: corsOptions,
  });

  io.on("connection", (socket) => {
    console.log("Người dùng đã kết nối:", socket.id);

    // Đăng ký người dùng với socket
    socket.on("register", (userId) => {
      console.log("Đăng ký người dùng:", userId, "với socket:", socket.id);
      userSocketMap.set(userId, socket.id);
      socket.userId = userId;
    });

    // Xử lý tin nhắn riêng tư
    socket.on("private_message", (data) => {
      const { receiverId, message } = data;
      const senderId = socket.userId;

      if (!senderId) {
        socket.emit("error", { message: "Bạn chưa đăng ký người dùng" });
        return;
      }

      // Tìm socket của người nhận
      const receiverSocketId = userSocketMap.get(receiverId);

      if (receiverSocketId) {
        // Gửi tin nhắn cho người nhận
        console.log("Gửi tin nhắn cho người nhận:", receiverSocketId);
        io.to(receiverSocketId).emit("private_message", {
          senderId,
          message,
          timestamp: new Date(),
        });

        // Gửi xác nhận lại cho người gửi
        socket.emit("message_sent", {
          receiverId,
          message,
          timestamp: new Date(),
        });
      } else {
        // Thông báo nếu người nhận không online
        socket.emit("error", {
          message: "Người dùng không trực tuyến hoặc không tồn tại",
        });
      }
    });

    // Xử lý ngắt kết nối
    socket.on("disconnect", () => {
      if (socket.userId) {
        userSocketMap.delete(socket.userId);
        console.log("Người dùng đã ngắt kết nối:", socket.userId);
      }
    });
  });

  return io;
}

module.exports = initializeSocket;
