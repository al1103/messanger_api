const express = require("express");
const router = express.Router();
const likeController = require("../controllers/likeController");
const authMiddleware = require("../middleware/auth");

router.post("/:postId", authMiddleware, likeController.likePost);
router.delete("/:postId", authMiddleware, likeController.unlikePost);
router.get("/count/:postId", likeController.getLikeCount);
router.get("/check/:postId", authMiddleware, likeController.checkUserLiked);
module.exports = router;
