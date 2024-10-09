const Post = require("../models/post");

exports.createPost = async (req, res) => {
  try {
    const { content } = req.body;
    const authorId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: "Nội dung bài viết là bắt buộc" });
    }

    const postId = await Post.create(authorId, content);
    res
      .status(201)
      .json({ message: "Bài viết đã được tạo thành công", postId });
  } catch (error) {
    console.error("Lỗi khi tạo bài viết:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi tạo bài viết" });
  }
};

exports.getPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const post = await Post.getById(postId);
    if (!post) {
      return res.status(404).json({ error: "Không tìm thấy bài viết" });
    }
    res.status(200).json(post);
  } catch (error) {
    console.error("Lỗi khi lấy bài viết:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi lấy bài viết" });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    const authorId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: "Nội dung bài viết là bắt buộc" });
    }

    const success = await Post.update(postId, authorId, content);
    if (!success) {
      return res
        .status(404)
        .json({
          error: "Không tìm thấy bài viết hoặc bạn không có quyền cập nhật",
        });
    }
    res.status(200).json({ message: "Bài viết đã được cập nhật thành công" });
  } catch (error) {
    console.error("Lỗi khi cập nhật bài viết:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi cập nhật bài viết" });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const authorId = req.user.id;

    const success = await Post.delete(postId, authorId);
    if (!success) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy bài viết hoặc bạn không có quyền xóa" });
    }
    res.status(200).json({ message: "Bài viết đã được xóa thành công" });
  } catch (error) {
    console.error("Lỗi khi xóa bài viết:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi xóa bài viết" });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const posts = await Post.getAll(page, pageSize);
    res.status(200).json(posts);
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bài viết:", error);
    res.status(500).json({ error: "Đã xảy ra lỗi khi lấy danh sách bài viết" });
  }
};
