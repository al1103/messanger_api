const { sql, poolPromise } = require("../config/database");

class Post {
  static async create(authorId, content) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("authorId", sql.Int, authorId)
        .input("content", sql.NVarChar, content).query(`
          INSERT INTO Posts (AuthorID, Content)
          VALUES (@authorId, @content);
          SELECT SCOPE_IDENTITY() AS PostID;
        `);
      return result.recordset[0].PostID;
    } catch (error) {
      console.error("Lỗi khi tạo bài viết:", error);
      throw error;
    }
  }

  static async getById(postId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request().input("postId", sql.Int, postId)
        .query(`
          SELECT p.*, u.Username
          FROM Posts p
          JOIN Users u ON p.AuthorID = u.UserID
          WHERE p.PostID = @postId
        `);
      return result.recordset[0];
    } catch (error) {
      console.error("Lỗi khi lấy bài viết:", error);
      throw error;
    }
  }

  static async update(postId, authorId, content) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("postId", sql.Int, postId)
        .input("authorId", sql.Int, authorId)
        .input("content", sql.NVarChar, content).query(`
          UPDATE Posts
          SET Content = @content, UpdatedAt = GETDATE()
          WHERE PostID = @postId AND AuthorID = @authorId;
          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error("Lỗi khi cập nhật bài viết:", error);
      throw error;
    }
  }

  static async delete(postId, authorId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("postId", sql.Int, postId)
        .input("authorId", sql.Int, authorId).query(`
          DELETE FROM Posts
          WHERE PostID = @postId AND AuthorID = @authorId;
          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error("Lỗi khi xóa bài viết:", error);
      throw error;
    }
  }

  static async getAll(page = 1, pageSize = 10) {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * pageSize;
      const result = await pool
        .request()
        .input("pageSize", sql.Int, pageSize)
        .input("offset", sql.Int, offset).query(`
          SELECT p.*, u.Username
          FROM Posts p
          JOIN Users u ON p.AuthorID = u.UserID
          ORDER BY p.CreatedAt DESC
          OFFSET @offset ROWS
          FETCH NEXT @pageSize ROWS ONLY;
        `);
      return result.recordset;
    } catch (error) {
      console.error("Lỗi khi lấy danh sách bài viết:", error);
      throw error;
    }
  }
}

module.exports = Post;
