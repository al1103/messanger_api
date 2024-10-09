const Message = require("../models/message");
const { handleNewMessage } = require("../controllers/googleGenerativeAI");
const socketConfig = require("../config/socket");

exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, content, isGroupMessage } = req.body;
    const senderId = req.user.id;
    console.log(senderId);

    if (!content || receiverId === undefined) {
      return res
        .status(400)
        .json({ error: "Nội dung tin nhắn và người nhận là bắt buộc" });
    }

    const messageId = await Message.createMessage(
      senderId,
      receiverId,
      content,
      isGroupMessage
    );

    // Sử dụng Socket.IO để gửi tin nhắn real-time
    const io = socketConfig.getIO();
    const newMessageData = {
      id: messageId,
      senderId,
      receiverId,
      content,
      isGroupMessage,
      timestamp: new Date(),
    };

    if (isGroupMessage) {
      io.to(`group_${receiverId}`).emit("newMessage", newMessageData);
    } else {
      io.to(`user_${receiverId}`).emit("newMessage", newMessageData);
    }

    res
      .status(201)
      .json({ message: "Tin nhắn đã được gửi thành công", messageId });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi gửi tin nhắn" });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const { user1Id, user2Id } = req.params;
    const limit = 10;

    const messages = await Message.getConversation(user1Id, user2Id, limit);
    const { handleNewMessage } = require("./googleGenerativeAI");
    const suggestions = await handleNewMessage(messages);

    res.status(200).json({
      success: true,
      messages: suggestions,
    });

    // Sử dụng Socket.IO để thông báo về cập nhật cuộc trò chuyện
    const io = socketConfig.getIO();
    io.to(`user_${user1Id}`).to(`user_${user2Id}`).emit("conversationUpdated", {
      user1Id,
      user2Id,
      messages: suggestions,
    });
  } catch (error) {
    console.error("Lỗi khi lấy cuộc trò chuyện:", error);
    res
      .status(500)
      .json({ success: false, error: "Đã xảy ra lỗi khi lấy cuộc trò chuyện" });
  }
};
