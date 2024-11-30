const { sql, poolPromise } = require("../config/database");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

class UserModel {
  static async register(username, email, password, fullName) {
    try {
      const pool = await poolPromise;
      const userId = uuidv4();

      const existingUser = await pool
        .request()
        .input("username", sql.NVarChar(50), username)
        .input("email", sql.NVarChar(100), email).query(`
        SELECT * FROM Users 
        WHERE Username = @username OR Email = @email;
      `);

      if (existingUser.recordset.length > 0) {
        throw new Error("Email hoặc tên người dùng đã tồn tại");
      }

      await pool
        .request()
        .input("userId", sql.VarChar(36), userId)
        .input("username", sql.NVarChar(50), username)
        .input("email", sql.NVarChar(100), email)
        .input("password", sql.NVarChar(255), password)
        .input("fullName", sql.NVarChar(100), fullName)
        .input("status", sql.VarChar(20), "offline").query(`
        INSERT INTO Users (
          UserID, Username, Email, Password, 
          FullName, Status, CreatedAt, UpdatedAt
        ) 
        VALUES (
          @userId, @username, @email, @password,
          @fullName, @status, GETDATE(), GETDATE()
        );
      `);
      return { userId };
    } catch (error) {
      console.error("Lỗi trong quá trình đăng ký:", error);
      throw error;
    }
  }

  static async login(email, password) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("email", sql.NVarChar(100), email).query(`
        SELECT UserID, Email, Password, Username, FullName, Avatar, Status
        FROM Users WHERE Email = @email
      `);

      const user = result.recordset[0];

      if (user && (await bcrypt.compare(password, user.Password))) {
        // Cập nhật trạng thái online và LastSeen
        await pool.request().input("userId", sql.VarChar(36), user.UserID)
          .query(`
            UPDATE Users 
            SET Status = 'online', 
                LastSeen = GETDATE(),
                UpdatedAt = GETDATE()
            WHERE UserID = @userId
          `);

        return {
          userId: user.UserID,
          email: user.Email,
          username: user.Username,
          fullName: user.FullName,
          avatar: user.Avatar,
          status: "online",
        };
      }
      return null;
    } catch (error) {
      console.error("Error in login:", error);
      throw error;
    }
  }

  static async sendCode(email, code) {
    try {
      const pool = await poolPromise;

      // Xóa mã cũ nếu có
      await pool.request().input("email", sql.NVarChar(255), email).query(`
          DELETE FROM VerificationCode 
          WHERE Email = @email
        `);

      // Thêm mã mới
      await pool
        .request()
        .input("email", sql.NVarChar(255), email)
        .input("code", sql.NVarChar(10), code)
        .input("type", sql.VarChar(20), "register")
        .input(
          "expirationTime",
          sql.DateTime,
          new Date(Date.now() + 10 * 60 * 1000)
        ).query(`
          INSERT INTO VerificationCode (
            Email, Code, Type, ExpirationTime, IsVerified, CreatedAt
          ) 
          VALUES (
            @email, @code, @type, @expirationTime, 0, GETDATE()
          );
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

  static async getUserById(userId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("userId", sql.VarChar(36), userId).query(`
          SELECT 
            UserID,
            Username,
            Email,
            FullName,
            Avatar 
          FROM Users 
          WHERE UserID = @userId 
        `);

      if (result.recordset.length === 0) {
        return null;
      }

      return result.recordset[0];
    } catch (error) {
      console.error("Error getting user by ID:", error);
      throw error;
    }
  }
}

module.exports = UserModel;
