const express = require("express");
const bodyParser = require("body-parser");
const rateLimit = require("express-rate-limit");
const { poolPromise } = require("./config/database");
const routes = require("./routers");
const cookieParser = require("cookie-parser");
const http = require("http");
const cors = require("cors");
const initializeSocket = require("./config/socket");

// Tạo ứng dụng express
const app = express();

// Khởi tạo server HTTP từ express app
const server = http.createServer(app);

// Cấu hình CORS
const corsOptions = {
  origin: "*", // Thay đổi thành origin của client
  methods: ["GET", "POST"],
  credentials: true,
};

app.use(cors(corsOptions));

// Thay thế phần socket.io cũ bằng:
const io = initializeSocket(server, corsOptions);

// Cấu hình rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 1000, // Giới hạn số yêu cầu
  standardHeaders: true,
  legacyHeaders: false,
  message: "Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút",
});

// Sử dụng middleware
app.use(limiter);
app.use(bodyParser.json());
app.use(cookieParser());

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

// Bắt đầu lắng nghe cổng từ server HTTP
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
