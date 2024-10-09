const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messageController");
const authMiddleware = require("../middleware/auth");

router.post("/", authMiddleware, messageController.sendMessage);
router.get(
  "/conversation/:user1Id/:user2Id",
  messageController.getConversation
);

module.exports = router;
