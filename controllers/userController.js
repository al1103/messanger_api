require("dotenv").config();
const bcrypt = require("bcrypt");
const UserModel = require("../models/user");
const Message = require("../models/message");
const jwt = require("jsonwebtoken");
const refreshTokens = [];
const { sendRandomCodeEmail } = require("../server/server");

exports.register = async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        status: 400,
        error: "Vui lòng điền đầy đủ thông tin",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 400,
        error: "Email không hợp lệ",
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        status: 400,
        error: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    const existingUser = await UserModel.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        status: 400,
        error: "Email đã được sử dụng",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Send verification code via email
    await sendRandomCodeEmail(email, code);
    console.log("Generated code:", code);

    // Save verification code to database
    await UserModel.sendCode(email, code);

    // Define userData
    const userData = { username, email, password: hashedPassword, fullName };

    // Create JWT token with user data (set expiration time for the token)
    const token = jwt.sign(userData, process.env.JWT_SECRET_KEY, {
      expiresIn: "1m",
    });

    return res.status(200).json({
      status: 200,
      message: "Vui lòng kiểm tra email để lấy mã xác nhận",
      token, // Send the token to the client
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      status: 500,
      error: "Đã xảy ra lỗi trong quá trình đăng ký",
    });
  }
};

exports.verifyRegistration = async (req, res) => {
  try {
    const { token, code } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token không tồn tại" });
    }

    if (!code) {
      return res.status(400).json({ error: "Mã xác nhận là bắt buộc" });
    }

    // Decode the token and retrieve user data
    let tempUser;
    try {
      tempUser = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (error) {
      return res
        .status(400)
        .json({ error: "Token không hợp lệ hoặc đã hết hạn" });
    }

    console.log(tempUser);
    console.log(tempUser.email, code);
    // Verify the code
    const isCodeValid = await UserModel.verifyCode(tempUser.email, code);
    if (!isCodeValid) {
      return res
        .status(400)
        .json({ error: "Mã xác nhận không hợp lệ hoặc đã hết hạn" });
    }

    const result = await UserModel.register(
      tempUser.username,
      tempUser.email,
      tempUser.password,
      tempUser.fullName
    );

    return res.status(201).json({
      status: 201,
      message: "Đăng ký thành công",
      userId: result.userId,
    });
  } catch (error) {
    console.error("Error during verification:", error);
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
      res.status(200).json({
        message: "thành công ",
        accessToken,
        refreshToken,
        data: user,
      });
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
