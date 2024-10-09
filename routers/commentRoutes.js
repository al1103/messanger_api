const express = require("express");
const router = express.Router();
const commentController = require("../controllers/commentController");
const authMiddleware = require("../middleware/auth");

router.post("/create", authMiddleware, commentController.createComment);
router.get("/post/:postId", commentController.getCommentsByPost);
router.put("/:commentId", authMiddleware, commentController.updateComment);
router.delete("/:commentId", authMiddleware, commentController.deleteComment);

module.exports = router;
