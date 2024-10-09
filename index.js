const express = require("express");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const { poolPromise } = require("./config/database");
const routes = require("./routers");
const cookieParser = require("cookie-parser");
const http = require("http");
const socketConfig = require("./config/socket");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const socketIo = require("socket.io");

// Tạo ứng dụng express
const app = express();

// Khởi tạo server HTTP từ express app
const server = http.createServer(app);

// Khởi tạo Socket.IO
const io = socketIo(server);
// Cấu hình rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 1000, // Giới hạn số yêu cầu
  standardHeaders: true,
  legacyHeaders: false,
  message: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút",
});
app.use(cors());
// Sử dụng middleware
app.use(limiter);
app.use(bodyParser.json());
app.use(cookieParser());

// Khởi tạo Socket.IO với cấu hình từ socketConfig
socketConfig.init(io);

// Khởi tạo kết nối pool
poolPromise
  .then(() => {
    console.log("Database pool initialized");
  })
  .catch((err) => {
    console.error("Error initializing database pool:", err);
    process.exit(1);
  });

// Định nghĩa các routes
routes(app);

// Middleware xử lý lỗi
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Đã xảy ra lỗi!");
});

// Xử lý kết nối Socket.IO
io.on("connection", (socket) => {
  console.log("Một người dùng đã kết nối");

  socket.on("disconnect", () => {
    console.log("Người dùng đã ngắt kết nối");
  });
});

// Bắt đầu lắng nghe cổng từ server HTTP
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
