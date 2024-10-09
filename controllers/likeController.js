const Like = require('../models/like');

exports.likePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const likeId = await Like.create(userId, postId);
    res.status(200).json({ message: 'Bài viết đã được like thành công', likeId });
  } catch (error) {
    console.error('Lỗi khi like bài viết:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi like bài viết' });
  }
};

exports.unlikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const success = await Like.delete(userId, postId);
    if (success) {
      res.status(200).json({ message: 'Đã bỏ like bài viết thành công' });
    } else {
      res.status(404).json({ error: 'Không tìm thấy like để xóa' });
    }
  } catch (error) {
    console.error('Lỗi khi bỏ like bài viết:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi bỏ like bài viết' });
  }
};

exports.getLikeCount = async (req, res) => {
  try {
    const { postId } = req.params;
    const likeCount = await Like.getCountByPostId(postId);
    res.status(200).json({ likeCount });
  } catch (error) {
    console.error('Lỗi khi lấy số lượng like:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi lấy số lượng like' });
  }
};

exports.checkUserLiked = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;
    const liked = await Like.checkUserLiked(userId, postId);
    res.status(200).json({ liked });
  } catch (error) {
    console.error('Lỗi khi kiểm tra like của người dùng:', error);
    res.status(500).json({ error: 'Đã xảy ra lỗi khi kiểm tra like của người dùng' });
  }
};
