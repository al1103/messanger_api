const { sql, poolPromise } = require("../config/database");
const crypto = require("node:crypto");
const socketConfig = require("../config/socket");

class Message {
  static async createMessage(senderId, receiverId, content, isGroupMessage = false) {
    try {
      const encryptedContent = this.encryptMessage(content);
      const pool = await poolPromise;

      const result = await pool
        .request()
        .input("senderId", sql.Int, senderId)
        .input("receiverId", sql.Int, receiverId)
        .input("content", sql.VarChar, encryptedContent)
        .input("isGroupMessage", sql.Bit, isGroupMessage).query(`
          INSERT INTO Messages (SenderId, ReceiverId, Content, IsGroupMessage) 
          VALUES (@senderId, @receiverId, @content, @isGroupMessage);
          SELECT SCOPE_IDENTITY() AS MessageID;
        `);

      const messageId = result.recordset[0].MessageID;

      const senderResult = await pool
        .request()
        .input("userId", sql.Int, senderId)
        .query("SELECT Username FROM Users WHERE UserID = @userId");

      const senderUsername = senderResult.recordset[0]?.Username;

      if (!senderUsername) {
        throw new Error("Sender username not found");
      }

      try {
        const io = socketConfig.getIO();
        const newMessageData = {
          id: messageId,
          senderId,
          senderUsername,
          content,
          timestamp: new Date(),
        };

        if (isGroupMessage) {
          newMessageData.groupId = receiverId;
          io.to(`group_${receiverId}`).emit("newMessage", newMessageData);
        } else {
          newMessageData.receiverId = receiverId;
          io.to(`user_${receiverId}`).emit("newMessage", newMessageData);
        }
      } catch (socketError) {
        console.error("Error sending message via Socket.IO:", socketError);
      }

      return messageId;
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }

  static async getAllMessages() {
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

  static async getMessageById(messageId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("messageId", sql.Int, messageId)
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

  static async getConversation(senderId, receiverId, limit = 10) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("senderId", sql.Int, senderId)
        .input("receiverId", sql.Int, receiverId)
        .input("limit", sql.Int, limit).query(`
          SELECT TOP (@limit) SenderID, ReceiverID, Content
          FROM Messages
          WHERE (SenderID = @senderId AND ReceiverID = @receiverId)
             OR (SenderID = @receiverId AND ReceiverID = @senderId)
          ORDER BY CreatedAt DESC
        `);

      const decryptedMessages = result.recordset.map((message) => ({
        ...message,
        Content: this.decryptMessage(message.Content),
      }));

      return decryptedMessages.reverse();
    } catch (error) {
      console.error("Error getting conversation:", error);
      throw error;
    }
  }

  static async updateMessage(messageId, newContent) {
    try {
      const encryptedContent = this.encryptMessage(newContent);
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("messageId", sql.Int, messageId)
        .input("content", sql.VarChar, encryptedContent)
        .query(`
          UPDATE Messages
          SET Content = @content
          WHERE MessageID = @messageId;
          SELECT @@ROWCOUNT AS AffectedRows;
        `);
      return result.recordset[0].AffectedRows > 0;
    } catch (error) {
      console.error("Error updating message:", error);
      throw error;
    }
  }

  static async deleteMessage(messageId) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("messageId", sql.Int, messageId)
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
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync("secret password", "salt", 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(message, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  static decryptMessage(encryptedMessage) {
    const algorithm = "aes-256-cbc";
    const key = crypto.scryptSync("secret password", "salt", 32);
    const [ivHex, encryptedHex] = encryptedMessage.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }
}

module.exports = Message;
