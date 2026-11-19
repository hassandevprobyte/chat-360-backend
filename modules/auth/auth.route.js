const express = require("express");
const router = express.Router();

// Controllers
const authController = require("./auth.controller");

// Middlewares
const protect = require("../../middleware/authMiddleware");
const { authLimiter } = require("../../middleware/rateLimiter");

router.post("/signup", authLimiter, authController.signup);
router.post("/login", authLimiter, authController.login);
router.get("/refresh", authLimiter, authController.refresh);
router.post("/logout", authLimiter, authController.logout);
router.post("/verifyEmail", authLimiter, protect, authController.verifyEmail);
router.post("/resendOtp", authLimiter, protect, authController.resendOtp);
router.patch("/changePassword", authLimiter, protect, authController.changePassword);

module.exports = router;
