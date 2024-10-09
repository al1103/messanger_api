const bcrypt = require("bcrypt");
const UserModel = require("../models/user");
const Message = require("../models/message");
const jwt = require("jsonwebtoken");
const refreshTokens = [];
const { sendRandomCodeEmail } = require("../server/server");

exports.register = async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email và mật khẩu là bắt buộc" });
    }

    const existingUser = await UserModel.getUserByEmail(email);

    if (existingUser) {
      return res.status(400).json({ error: "Người dùng đã tồn tại" });
    }

    // Hash mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const code = await sendRandomCodeEmail("tuanpa@hblab.vn");
      await UserModel.sendCode(email, code);
    } catch (error) {
      console.error("Lỗi khi gửi email:", error);
      return res.status(500).json({ error: "Lỗi khi gửi mã xác nhận" });
    }

    // Lưu thông tin tạm thời vào cookie
    res.cookie(
      "tempUser",
      JSON.stringify({
        username,
        email,
        password: hashedPassword,
        fullName,
      }),
      { maxAge: 600000, httpOnly: true }
    ); // Cookie hết hạn sau 10 phút

    return res
      .status(200)
      .json({ message: "Vui lòng kiểm tra email để lấy mã xác nhận" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Đã xảy ra lỗi" });
  }
};

exports.verifyRegistration = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Mã xác nhận là bắt buộc" });
    }

    const tempUser = req.cookies.tempUser
      ? JSON.parse(req.cookies.tempUser)
      : null;

    console.log("Người dùng tạm thời từ cookie:", tempUser);

    const isCodeValid = await UserModel.verifyCode(tempUser.email, code);

    if (!tempUser || !isCodeValid) {
      return res
        .status(400)
        .json({ error: "Mã xác nhận không hợp lệ hoặc đã hết hạn" });
    }

    try {
      const result = await UserModel.register(
        tempUser.username,
        tempUser.email,
        tempUser.password,
        tempUser.fullName
      );
      console.log(result);
      res.clearCookie("tempUser");
      return res
        .status(201)
        .json({ message: "Đăng ký thành công", userId: result.userId });
    } catch (registerError) {
      if (registerError.message === "Email hoặc tên người dùng đã tồn tại") {
        return res.status(400).json({ error: registerError.message });
      }
      throw registerError;
    }
  } catch (error) {
    console.error("Lỗi trong quá trình đăng ký:", error);
    return res
      .status(500)
      .json({ error: "Đã xảy ra lỗi. Vui lòng thử lại sau." });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.login(email, password);
    if (user) {
      const accessToken = generateAccessToken(user);
      const refreshToken = jwt.sign(user, process.env.REFRESH_SECRET_KEY);
      refreshTokens.push(refreshToken);
      res
        .status(200)
        .json({ message: "thành công ", accessToken, refreshToken, user });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "An error occurred during login" });
  }
};
exports.token = async (req, res) => {
  const refreshToken = req.body.token;
  if (refreshToken == null) return res.sendStatus(401);
  if (!refreshTokens.includes(refreshToken)) return res.sendStatus(403);
  jwt.verify(refreshToken, process.env.REFRESH_SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    const accessToken = generateAccessToken({ username: user.username });
    res.json({ accessToken: accessToken });
  });
};

function generateAccessToken(user) {
  return jwt.sign(user, process.env.SECRET_KEY, { expiresIn: "2000d" });
}

exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.getAll();
    res.json(messages);
  } catch (err) {
    console.error("Error fetching messages:", err);
    res
      .status(500)
      .json({ error: "An error occurred while fetching messages" });
  }
};
