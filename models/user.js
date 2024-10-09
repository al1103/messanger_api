const { sql, poolPromise } = require("../config/database");
const bcrypt = require("bcrypt");
class UserModel {
  static async register(username, email, password, fullName) {
    try {
      const pool = await poolPromise;

      const existingUser = await pool
        .request()
        .input("username", sql.VarChar, username)
        .input("email", sql.VarChar, email).query(`
    SELECT * FROM Users WHERE Username = @username OR Email = @email;
  `);

      if (existingUser.recordset.length > 0) {
        // Trả về lỗi nếu Username hoặc Email đã tồn tại
        return res
          .status(400)
          .json({ error: "Username hoặc Email đã tồn tại" });
      }
      const result = await pool
        .request()
        .input("username", sql.VarChar, username)
        .input("fullName", sql.VarChar, fullName)
        .input("email", sql.VarChar, email)
        .input("password", sql.VarChar, password).query(`
          INSERT INTO Users (Username, Email, Password, FullName) 
          VALUES (@username, @email, @password, @fullName);
          SELECT SCOPE_IDENTITY() AS UserID;
        `);
      return { userId: result.recordset[0].UserID };
    } catch (error) {
      console.error("Lỗi trong quá trình đăng ký:", error);
      if (error.number === 2627) {
        throw new Error("Email hoặc tên người dùng đã tồn tại");
      }
      throw error;
    }
  }

  static async login(email, password) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("email", sql.VarChar, email)
        .query(
          "SELECT UserID, Email, Password FROM Users WHERE Email = @email"
        );

      const user = result.recordset[0];

      if (user && (await bcrypt.compare(password, user.Password))) {
        return { userId: user.UserID, email: user.Email };
      } else {
        console.log("Login failed for user:", email);
        return null;
      }
    } catch (error) {
      console.error("Error in login:", error);
      throw error;
    }
  }

  static async sendCode(email, code) {
    try {
      const pool = await poolPromise;
      await pool
        .request()
        .input("email", sql.VarChar, email)
        .input("code", sql.VarChar, code)
        .input(
          "expirationTime",
          sql.DateTime,
          new Date(Date.now() + 10 * 60 * 1000)
        ) // Thời gian hết hạn 10 phút
        .query(`
    INSERT INTO VerificationCode (Email, Code, ExpirationTime) 
    VALUES (@email, @code, @expirationTime);
  `);
    } catch (error) {
      console.error("Lỗi trong sendCode:", error);
      throw error;
    }
  }

  static async verifyCode(email, code) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("email", sql.VarChar, email)
        .input("code", sql.VarChar, code).query(`
          SELECT * FROM VerificationCode 
          WHERE Email = @email AND Code = @code ;
        `);
      console.log(result);
      return result.recordset.length > 0;
    } catch (error) {
      console.error("Lỗi trong checkVerificationCode:", error);
      throw error;
    }
  }

  static async getUserByEmail(email) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("email", sql.VarChar, email)
        .query("SELECT * FROM Users WHERE Email = @email");
      return result.recordset[0];
    } catch (error) {
      console.error("Error in getUserByEmail:", error);
      throw error;
    }
  }
}

module.exports = UserModel;
