const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);

router.post("/send", messageController.sendMessage);
router.get(
  "/conversations/:senderId/:receiverId",
  messageController.getConversation
);
router.get("/user/:id", messageController.getMessages);
router.delete("/:messageId", messageController.deleteMessage);
router.put("/update", messageController.updateMessage);

module.exports = router;
