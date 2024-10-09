const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const authMiddleware = require("../middleware/auth");

router.post("/create", authMiddleware, postController.createPost);
router.get("/:postId", postController.getPost);
router.put("/:postId", authMiddleware, postController.updatePost);
router.delete("/:postId", authMiddleware, postController.deletePost);
router.get("/", postController.getAllPosts);

module.exports = router;
