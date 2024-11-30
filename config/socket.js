// config/socket.js
const socketIO = require("socket.io");

function initializeSocket(server, corsOptions) {
  const defaultCorsOptions = {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  };

  const io = socketIO(server, {
    cors: corsOptions || defaultCorsOptions,
    pingTimeout: 60000,
    pingInterval: 25000,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Setup socket event handlers
  io.on("connection", (socket) => {
    console.log(`New socket connection: ${socket.id}`);

    // Register user
    socket.on("register", (userId) => {
      if (userId) {
        socket.userId = userId;
        socket.join(userId);
        console.log(`User registered: ${userId}`);
      }
    });

    // Handle private messages
    socket.on("private_message", (data) => {
      try {
        const { receiverId, message } = data;
        console.log(`Sending message to ${receiverId}:`, message);

        // Emit to specific receiver
        io.to(receiverId).emit("newMessage", {
          messageId: data.messageId,
          senderId: socket.userId,
          content: message,
          createdAt: new Date(),
        });

        // Acknowledge message sent
        socket.emit("message_sent", {
          messageId: data.messageId,
          status: "sent",
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("message_error", {
          messageId: data.messageId,
          error: "Failed to send message",
        });
      }
    });

    // Handle typing status
    socket.on("typing", (data) => {
      const { receiverId, isTyping } = data;
      io.to(receiverId).emit("user_typing", {
        userId: socket.userId,
        isTyping,
      });
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });

  return io;
}

module.exports = initializeSocket;
