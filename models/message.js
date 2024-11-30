const { sql, poolPromise } = require("../config/database");
const crypto = require("node:crypto");
const { v4: uuidv4 } = require("uuid");

class Message {
  static async createMessage(
    messageId,
    senderId,
    receiverId,
    content,
    messageType = "text",
    mediaURL = null,
    fileName = null,
    fileSize = null,
    isGroupMessage = false
  ) {
    try {
      const pool = await poolPromise;

      // Check users exist
      const userResult = await pool
        .request()
        .input("senderId", sql.VarChar(36), senderId)
        .input("receiverId", sql.VarChar(36), receiverId).query(`
          SELECT 
            (SELECT UserID FROM Users WHERE UserID = @senderId) as SenderId,
            (SELECT UserID FROM Users WHERE UserID = @receiverId) as ReceiverId
        `);

      if (!userResult.recordset[0]?.SenderId) {
        throw new Error(`Sender ${senderId} not found`);
      }

      if (!userResult.recordset[0]?.ReceiverId) {
        throw new Error(`Receiver ${receiverId} not found`);
      }

      // Encrypt content
      const encryptedContent = this.encryptMessage(content);

      // Insert message with BEGIN TRAN
      const result = await pool
        .request()
        .input("messageId", sql.VarChar(36), messageId)
        .input("senderId", sql.VarChar(36), senderId)
        .input("receiverId", sql.VarChar(36), receiverId)
        .input("content", sql.NVarChar(sql.MAX), encryptedContent)
        .input("messageType", sql.VarChar(50), messageType)
        .input("mediaURL", sql.NVarChar(255), mediaURL)
        .input("fileName", sql.NVarChar(255), fileName)
        .input("fileSize", sql.BigInt, fileSize || 0)
        .input("isGroupMessage", sql.Bit, isGroupMessage).query(`
          BEGIN TRY
            BEGIN TRAN
            
            INSERT INTO Messages (
              MessageID, SenderID, ReceiverID, Content,
              MessageType, MediaURL, FileName, FileSize,
              IsGroupMessage, Status, IsRead,
              CreatedAt, UpdatedAt
            )
            VALUES (
              @messageId, @senderId, @receiverId, @content,
              @messageType, @mediaURL, @fileName, @fileSize,
              @isGroupMessage, 'sent', 0,
              GETDATE(), GETDATE()
            );
            
            SELECT TOP 1 
              MessageID, SenderID, ReceiverID, Content,
              MessageType, MediaURL, FileName, FileSize,
              Status, IsRead, IsGroupMessage,
              CreatedAt, UpdatedAt
            FROM Messages 
            WHERE MessageID = @messageId;

            COMMIT TRAN
          END TRY
          BEGIN CATCH
            ROLLBACK TRAN
            THROW;
          END CATCH
        `);

      const message = result.recordset[0];
      return {
        messageId: message.MessageID,
        senderId: message.SenderID,
        receiverId: message.ReceiverID,
        content: this.decryptMessage(message.Content),
        messageType: message.MessageType,
        mediaURL: message.MediaURL,
        fileName: message.FileName,
        fileSize: message.FileSize,
        status: message.Status,
        isRead: message.IsRead,
        isGroupMessage: message.IsGroupMessage,
        createdAt: message.CreatedAt,
        updatedAt: message.UpdatedAt,
      };
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }

  static async getOrCreateConversation(senderId, receiverId) {
    try {
      const pool = await poolPromise;

      const existingConversation = await pool
        .request()
        .input("senderId", sql.VarChar(36), senderId)
        .input("receiverId", sql.VarChar(36), receiverId).query(`
          SELECT c.ConversationID
          FROM Conversations c
          JOIN ConversationMembers cm1 ON c.ConversationID = cm1.ConversationID
          JOIN ConversationMembers cm2 ON c.ConversationID = cm2.ConversationID
          WHERE c.Type = 'private'
          AND ((cm1.UserID = @senderId AND cm2.UserID = @receiverId)
          OR (cm1.UserID = @receiverId AND cm2.UserID = @senderId))
        `);

      if (existingConversation.recordset.length > 0) {
        return existingConversation.recordset[0].ConversationID;
      }

      const conversationId = uuidv4();
      await pool
        .request()
        .input("conversationId", sql.VarChar(36), conversationId)
        .input("senderId", sql.VarChar(36), senderId)
        .input("receiverId", sql.VarChar(36), receiverId).query(`
          BEGIN TRANSACTION;

          INSERT INTO Conversations (
            ConversationID, Type, CreatedAt, UpdatedAt
          )
          VALUES (
            @conversationId, 'private', GETDATE(), GETDATE()
          );

          INSERT INTO ConversationMembers (
            ConversationID, UserID, JoinedAt
          )
          VALUES 
            (@conversationId, @senderId, GETDATE()),
            (@conversationId, @receiverId, GETDATE());

          COMMIT;
        `);

      return conversationId;
    } catch (error) {
      console.error("Error in getOrCreateConversation:", error);
      throw error;
    }
  }

  async getAllMessages() {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .query("SELECT * FROM Messages ORDER BY Timestamp DESC");

      return result.recordset.map((message) => ({
        ...message,
        Content: this.decryptMessage(message.Content),
      }));
    } catch (error) {
      console.error("Error getting all messages:", error);
      throw error;
    }
  }

  async getMessageById(messageId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("messageId", sql.VarChar(sql.MAX), messageId)
        .query("SELECT * FROM Messages WHERE MessageID = @messageId");

      if (result.recordset.length > 0) {
        const message = result.recordset[0];
        return {
          ...message,
          Content: this.decryptMessage(message.Content),
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting message by ID:", error);
      throw error;
    }
  }

  static async getMessages(id) {
    try {
      const pool = await poolPromise;
      const result = await pool.request().input("id", sql.VarChar(sql.MAX), id)
        .query(`
          WITH LatestMessages AS (
            SELECT 
              CASE 
                WHEN SenderID = @id THEN ReceiverID
                ELSE SenderID 
              END AS UserID,
              Content,
              CreatedAt,
              ROW_NUMBER() OVER (
                PARTITION BY 
                  CASE 
                    WHEN SenderID = @id THEN ReceiverID
                    ELSE SenderID 
                  END
                ORDER BY CreatedAt DESC
              ) as RowNum
            FROM Messages
            WHERE (SenderID = @id OR ReceiverID = @id)
          )
          SELECT DISTINCT
            m.UserID,
            u.Username,
            u.Avatar,
            m.Content as LastMessage,
            m.CreatedAt as LastMessageTime
          FROM LatestMessages m
          INNER JOIN Users u ON u.UserID = m.UserID
          WHERE m.RowNum = 1 AND m.UserID != @id
          ORDER BY m.CreatedAt DESC;
        `);

      return result.recordset.map((record) => ({
        ...record,
        LastMessage: Message.decryptMessage(record.LastMessage),
        UserID: record.UserID.toString(),
      }));
    } catch (error) {
      console.error("Error getting messages:", error);
      throw error;
    }
  }

  static async getConversation(senderId, receiverId, pageSize = 10, page = 1) {
    try {
      const offset = (page - 1) * pageSize;
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("senderId", sql.VarChar(36), senderId)
        .input("receiverId", sql.VarChar(36), receiverId)
        .input("pageSize", sql.Int, pageSize)
        .input("offset", sql.Int, offset).query(`
          SELECT 
            MessageID, SenderID, ReceiverID, Content, 
            MessageType, MediaURL, FileName, FileSize,
            CreatedAt, Status, IsRead, IsGroupMessage
          FROM Messages
          WHERE 
            (SenderID = @senderId AND ReceiverID = @receiverId)
            OR (SenderID = @receiverId AND ReceiverID = @senderId)
          ORDER BY CreatedAt DESC
          OFFSET @offset ROWS
          FETCH NEXT @pageSize ROWS ONLY
        `);

      return result.recordset;
    } catch (error) {
      console.error("Error getting conversation:", error);
      throw error;
    }
  }

  static async getTotalMessages(senderId, receiverId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("senderId", sql.VarChar(36), senderId) // Changed from sql.Int
        .input("receiverId", sql.VarChar(36), receiverId) // Changed from sql.Int
        .query(`
          SELECT COUNT(*) as total
          FROM Messages  
          WHERE ((SenderID = @senderId AND ReceiverID = @receiverId)
             OR (SenderID = @receiverId AND ReceiverID = @senderId))
        `);

      return result.recordset[0].total;
    } catch (error) {
      console.error("Error getting total messages:", error);
      throw error;
    }
  }

  static async updateMessage(messageId, newContent) {
    try {
      const encryptedContent = this.encryptMessage(newContent);
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("messageId", sql.VarChar(36), messageId)
        .input("content", sql.NVarChar(sql.MAX), encryptedContent).query(`
          UPDATE Messages
          SET Content = @content, UpdatedAt = GETDATE()
          WHERE MessageID = @messageId;
          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error("Error updating message:", error);
      throw error;
    }
  }

  async deleteMessage(messageId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request().input("messageId", sql.Int, messageId)
        .query(`
          DELETE FROM Messages
          WHERE MessageID = @messageId;
          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }
  static encryptMessage(message) {
    try {
      if (!message) return "";

      const algorithm = "aes-256-cbc";
      const key = crypto.scryptSync("secret password", "salt", 32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(String(message), "utf8", "hex");
      encrypted += cipher.final("hex");
      return `${iv.toString("hex")}:${encrypted}`;
    } catch (error) {
      console.error("Encryption error:", error);
      return "";
    }
  }

  static decryptMessage(encryptedMessage) {
    try {
      if (!encryptedMessage) return "";

      const algorithm = "aes-256-cbc";
      const key = crypto.scryptSync("secret password", "salt", 32);

      const [ivHex, encryptedHex] = encryptedMessage.split(":");
      if (!ivHex || !encryptedHex) return "";

      const iv = Buffer.from(ivHex, "hex");
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encryptedHex, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch (error) {
      console.error("Decryption error:", error);
      return "";
    }
  }

  static async deleteMessage(messageId, userId) {
    try {
      const pool = await poolPromise;

      // Get message info first for socket notification
      const messageInfo = await pool
        .request()
        .input("messageId", sql.VarChar(36), messageId).query(`
          SELECT ReceiverID, SenderID
          FROM Messages 
          WHERE MessageID = @messageId
        `);

      if (!messageInfo.recordset[0]) {
        return {
          success: false,
          message: "Tin nhắn không tồn tại",
        };
      }

      // Delete message with transaction
      const result = await pool
        .request()
        .input("messageId", sql.VarChar(36), messageId)
        .input("userId", sql.VarChar(36), userId).query(`
          BEGIN TRY
            BEGIN TRAN;
            
            DELETE FROM Messages
            WHERE MessageID = @messageId
              AND (SenderID = @userId OR ReceiverID = @userId);
              
            SELECT @@ROWCOUNT AS DeletedCount;
            
            COMMIT TRAN;
          END TRY
          BEGIN CATCH
            ROLLBACK TRAN;
            THROW;
          END CATCH
        `);

      const deletedCount = result.recordset[0].DeletedCount;
      return {
        success: deletedCount > 0,
        message:
          deletedCount > 0
            ? "Xóa tin nhắn thành công"
            : "Không thể xóa tin nhắn",
        receiverId: messageInfo.recordset[0].ReceiverID,
        senderId: messageInfo.recordset[0].SenderID,
      };
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  }
}

module.exports = Message;
