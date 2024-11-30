const usersRouter = require("./userRoutes");
const messageRoutes = require("./messageRoutes");
const postRoutes = require("./posts");
const commentRoutes = require("./commentRoutes");
const likeRoutes = require("./like");
const aiRoutes = require("./aiRoutes");
function routes(app) {
  app.use("/api/auth", usersRouter);
  app.use("/api/messages", messageRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/comments", commentRoutes);
  app.use("/api/likes", likeRoutes);
  app.use("/api/ai", aiRoutes);
}

module.exports = routes;
