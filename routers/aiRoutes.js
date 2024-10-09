const express = require("express");
const router = express.Router();
const {
  handleNewMessage,
  handleImageAndPrompt,
  promptAnswer,
} = require("../controllers/googleGenerativeAI");

router.post("/chat", handleNewMessage);
router.post("/image-prompt", handleImageAndPrompt);
router.post("/promptAnswer", promptAnswer);
module.exports = router;
