const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
router.post("/login", userController.login);
router.post("/register", userController.register);
router.post("/verify-registration", userController.verifyRegistration);

module.exports = router;
router.post("/token", userController.token);
router.get("/messages", userController.getMessages);
module.exports = router;
