const Comment = require("../models/comment");

exports.createComment = async (req, res) => {
  try {
    const { postId, content, parentCommentId } = req.body;
    const authorId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: "Nội dung bình luận là bắt buộc" });
    }

    const commentId = await Comment.create(
      postId,
      authorId,
      content,
      parentCommentId
    );
    res
      .status(201)
      .json({ message: "Bình luận đã được tạo thành công", commentId });
  } catch (error) {
    console.error("Lỗi khi tạo bình luận:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi tạo bình luận" });
  }
};

exports.getCommentsByPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await Comment.getByPostId(postId);
    res.status(200).json(comments);
  } catch (error) {
    console.error("Lỗi khi lấy bình luận:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi lấy bình luận" });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;
    const authorId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: "Nội dung bình luận là bắt buộc" });
    }

    const success = await Comment.update(commentId, authorId, content);
    if (!success) {
      return res.status(404).json({
        error: "Không tìm thấy bình luận hoặc bạn không có quyền cập nhật",
      });
    }
    res.status(200).json({ message: "Bình luận đã được cập nhật thành công" });
  } catch (error) {
    console.error("Lỗi khi cập nhật bình luận:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi cập nhật bình luận" });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const authorId = req.user.id;

    const success = await Comment.delete(commentId, authorId);
    if (!success) {
      return res.status(404).json({
        error: "Không tìm thấy bình luận hoặc bạn không có quyền xóa",
      });
    }
    res.status(200).json({ message: "Bình luận đã được xóa thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa bình luận:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi xóa bình luận" });
  }
};
