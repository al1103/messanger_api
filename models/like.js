const { sql, poolPromise } = require("../config/database");

class Like {
  static async create(userId, postId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('userId', sql.Int, userId)
        .input('postId', sql.Int, postId)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM Likes WHERE UserID = @userId AND PostID = @postId)
          BEGIN
            INSERT INTO Likes (UserID, PostID)
            VALUES (@userId, @postId);
            SELECT SCOPE_IDENTITY() AS LikeID;
          END
          ELSE
          BEGIN
            SELECT LikeID FROM Likes WHERE UserID = @userId AND PostID = @postId;
          END
        `);
      return result.recordset[0].LikeID;
    } catch (error) {
      console.error('Lỗi khi tạo like:', error);
      throw error;
    }
  }

  static async delete(userId, postId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('userId', sql.Int, userId)
        .input('postId', sql.Int, postId)
        .query(`
          DELETE FROM Likes
          WHERE UserID = @userId AND PostID = @postId;
          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error('Lỗi khi xóa like:', error);
      throw error;
    }
  }

  static async getCountByPostId(postId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('postId', sql.Int, postId)
        .query(`
          SELECT COUNT(*) AS LikeCount
          FROM Likes
          WHERE PostID = @postId;
        `);
      return result.recordset[0].LikeCount;
    } catch (error) {
      console.error('Lỗi khi lấy số lượng like:', error);
      throw error;
    }
  }

  static async checkUserLiked(userId, postId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('userId', sql.Int, userId)
        .input('postId', sql.Int, postId)
        .query(`
          SELECT 1 AS Liked
          FROM Likes
          WHERE UserID = @userId AND PostID = @postId;
        `);
      return result.recordset.length > 0;
    } catch (error) {
      console.error('Lỗi khi kiểm tra like của người dùng:', error);
      throw error;
    }
  }
}

module.exports = Like;
