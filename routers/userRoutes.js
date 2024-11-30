const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/auth");

// Public routes
router.post("/login", userController.login);
router.post("/register", userController.register);
router.post("/verify-registration", userController.verifyRegistration);
router.post("/token", userController.token);

// Protected routes
router.use(authMiddleware);
router.get("/messages", userController.getMessages);
// router.put("/status", userController.updateStatus);

module.exports = router;
