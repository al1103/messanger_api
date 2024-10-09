const { sql, poolPromise } = require("../config/database");

class Comment {
  static async create(postId, authorId, content, parentCommentId = null) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('postId', sql.Int, postId)
        .input('authorId', sql.Int, authorId)
        .input('content', sql.NVarChar, content)
        .input('parentCommentId', sql.Int, parentCommentId)
        .query(`
          INSERT INTO Comments (PostID, AuthorID, Content, ParentCommentID)
          VALUES (@postId, @authorId, @content, @parentCommentId);
          SELECT SCOPE_IDENTITY() AS CommentID;
        `);
      return result.recordset[0].CommentID;
    } catch (error) {
      console.error('Lỗi khi tạo bình luận:', error);
      throw error;
    }
  }

  static async getByPostId(postId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('postId', sql.Int, postId)
        .query(`
          WITH CommentCTE AS (
            SELECT c.*, u.Username, 0 AS Level
            FROM Comments c
            JOIN Users u ON c.AuthorID = u.UserID
            WHERE c.PostID = @postId AND c.ParentCommentID IS NULL AND c.IsDeleted = 0
            
            UNION ALL
            
            SELECT c.*, u.Username, cte.Level + 1
            FROM Comments c
            JOIN Users u ON c.AuthorID = u.UserID
            JOIN CommentCTE cte ON c.ParentCommentID = cte.CommentID
            WHERE c.PostID = @postId AND c.IsDeleted = 0
          )
          SELECT * FROM CommentCTE
          ORDER BY 
            CASE 
              WHEN ParentCommentID IS NULL THEN CommentID 
              ELSE ParentCommentID 
            END,
            CreatedAt
        `);
      return result.recordset;
    } catch (error) {
      console.error('Lỗi khi lấy bình luận:', error);
      throw error;
    }
  }

  static async update(commentId, authorId, content) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("commentId", sql.Int, commentId)
        .input("authorId", sql.Int, authorId)
        .input("content", sql.NVarChar, content).query(`
          UPDATE Comments
          SET Content = @content, UpdatedAt = GETDATE()
          WHERE CommentID = @commentId AND AuthorID = @authorId;
          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error("Lỗi khi cập nhật bình luận:", error);
      throw error;
    }
  }

  static async softDelete(commentId, authorId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('commentId', sql.Int, commentId)
        .input('authorId', sql.Int, authorId)
        .query(`
          UPDATE Comments
          SET IsDeleted = 1
          WHERE CommentID = @commentId AND AuthorID = @authorId;
          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error('Lỗi khi xóa mềm bình luận:', error);
      throw error;
    }
  }

  static async softDeleteWithChildren(commentId, authorId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('commentId', sql.Int, commentId)
        .input('authorId', sql.Int, authorId)
        .query(`
          WITH CommentTree AS (
            SELECT CommentID
            FROM Comments
            WHERE CommentID = @commentId AND AuthorID = @authorId AND IsDeleted = 0
            
            UNION ALL
            
            SELECT c.CommentID
            FROM Comments c
            INNER JOIN CommentTree ct ON c.ParentCommentID = ct.CommentID
            WHERE c.IsDeleted = 0
          )
          UPDATE c
          SET IsDeleted = 1, UpdatedAt = GETDATE()
          FROM Comments c
          INNER JOIN CommentTree ct ON c.CommentID = ct.CommentID
          WHERE c.IsDeleted = 0;

          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error('Lỗi khi xóa mềm bình luận và các bình luận con:', error);
      throw error;
    }
  }

  static async delete(commentId, authorId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("commentId", sql.Int, commentId)
        .input("authorId", sql.Int, authorId).query(`
          DELETE FROM Comments
          WHERE CommentID = @commentId AND AuthorID = @authorId;
          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error("Lỗi khi xóa bình luận:", error);
      throw error;
    }
  }

  static async deleteWithChildren(commentId, authorId) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      const request = new sql.Request(transaction);
      request.input('commentId', sql.Int, commentId);
      request.input('authorId', sql.Int, authorId);

      // Lấy tất cả các comment con
      const childComments = await request.query(`
        WITH CommentTree AS (
          SELECT CommentID
          FROM Comments
          WHERE CommentID = @commentId AND AuthorID = @authorId
          
          UNION ALL
          
          SELECT c.CommentID
          FROM Comments c
          INNER JOIN CommentTree ct ON c.ParentCommentID = ct.CommentID
        )
        SELECT CommentID FROM CommentTree
      `);

      // Xóa các comment từ dưới lên trên
      for (const row of childComments.recordset.reverse()) {
        await request.query(`
          DELETE FROM Comments WHERE CommentID = ${row.CommentID}
        `);
      }

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      console.error('Lỗi khi xóa bình luận và các bình luận con:', error);
      throw error;
    }
  }
}

module.exports = Comment;
