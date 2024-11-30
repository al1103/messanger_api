const Message = require("../models/message");
const { v4: uuidv4 } = require("uuid");
const UserModel = require("../models/user"); // Add this import
let socketInstance = null;

// Set socket instance
exports.setSocketInstance = (instance) => {
  socketInstance = instance;
};

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, messageType, mediaURL, fileName, fileSize } =
      req.body;

    const senderId = req.user.id;
    const messageId = uuidv4();

    // Validate required fields
    if (!content || !receiverId) {
      return res.status(400).json({
        status: 400,
        message: "Message content and receiver are required",
      });
    }

    // Validate receiver exists
    const receiver = await UserModel.getUserById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        status: 404,
        message: "Receiver not found",
      });
    }

    const newMessage = await Message.createMessage(
      messageId,
      senderId,
      receiverId,
      content,
      messageType || "text",
      mediaURL,
      fileName,
      fileSize
    );

    if (socketInstance) {
      socketInstance.to(receiverId).emit("newMessage", {
        ...newMessage,
        senderUsername: req.user.username,
      });
    }

    return res.status(201).json({
      status: 201,
      message: "Message sent successfully",
      data: newMessage,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    return res.status(500).json({
      status: 500,
      message: "An error occurred while sending the message",
      error: error.message,
    });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        status: 400,
        message: "User ID is required",
      });
    }

    const data = await Message.getMessages(id);
    res.status(200).json({
      data,
      status: 200,
      message: "Messages retrieved successfully",
    });
  } catch (error) {
    console.error("Error retrieving messages:", error);
    res.status(500).json({
      status: 500,
      message: "An error occurred while retrieving messages",
      error: error.message,
    });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const { senderId, receiverId } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    // Validate parameters
    if (!senderId || !receiverId) {
      return res.status(400).json({
        status: 400,
        message: "User information is missing",
      });
    }

    // Validate UUID format
    if (
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        senderId
      ) ||
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        receiverId
      )
    ) {
      return res.status(400).json({
        status: 400,
        message: "Invalid user ID format. Must be UUID",
      });
    }

    const messages = await Message.getConversation(
      senderId,
      receiverId,
      parseInt(pageSize),
      parseInt(page)
    );

    const totalMessages = await Message.getTotalMessages(senderId, receiverId);

    const formattedMessages = messages.map((msg) => ({
      messageId: msg.MessageID,
      senderId: msg.SenderID,
      receiverId: msg.ReceiverID,
      content: Message.decryptMessage(msg.Content),
      messageType: msg.MessageType,
      mediaURL: msg.MediaURL,
      fileName: msg.FileName,
      fileSize: msg.FileSize,
      status: msg.Status,
      isRead: msg.IsRead,
      isGroupMessage: msg.IsGroupMessage,
      createdAt: msg.CreatedAt,
      updatedAt: msg.UpdatedAt,
    }));

    return res.status(200).json({
      data: formattedMessages,
      status: 200,
      message: "Conversation retrieved successfully",
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalMessages,
    });
  } catch (error) {
    console.error("Error retrieving conversation:", error);
    return res.status(500).json({
      status: 500,
      message: "An error occurred",
      error: error.message,
    });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    if (!messageId) {
      return res.status(400).json({
        status: 400,
        message: "Message ID is required",
      });
    }

    const result = await Message.deleteMessage(messageId, userId);

    if (result.success) {
      if (socketInstance) {
        socketInstance.emit("message", {
          type: "deleted",
          messageId: messageId,
          receiverId: result.receiverId,
        });
      }

      res.status(200).json({
        status: 200,
        message: "Message deleted successfully",
      });
    } else {
      res.status(403).json({
        status: 403,
        message: result.message || "Not authorized to delete this message",
      });
    }
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({
      status: 500,
      message: "An error occurred while deleting the message",
      error: error.message,
    });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    if (!messageId) {
      return res.status(400).json({
        status: 400,
        message: "Message ID is required",
      });
    }

    const result = await Message.markAsRead(messageId, userId);

    if (result.success) {
      if (socketInstance) {
        socketInstance.emit("message", {
          type: "read",
          messageId: messageId,
          senderId: result.senderId,
        });
      }

      res.status(200).json({
        status: 200,
        message: "Message marked as read",
      });
    } else {
      res.status(403).json({
        status: 403,
        message: result.message || "Unable to mark message as read",
      });
    }
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({
      status: 500,
      message: "An error occurred",
      error: error.message,
    });
  }
};

exports.updateMessage = async (req, res) => {
  try {
    const { messageId, newContent } = req.body;

    if (!messageId || !newContent) {
      return res.status(400).json({
        status: 400,
        message: "Message ID and new content are required",
      });
    }

    const isUpdated = await Message.updateMessage(messageId, newContent);

    if (isUpdated) {
      return res.status(200).json({
        status: 200,
        message: "Message updated successfully",
      });
    } else {
      return res.status(404).json({
        status: 404,
        message: "Message not found",
      });
    }
  } catch (error) {
    console.error("Error updating message:", error);
    return res.status(500).json({
      status: 500,
      message: "An error occurred while updating the message",
    });
  }
};
