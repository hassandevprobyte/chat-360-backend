const express = require("express");
const router = express.Router();

// Controllers
const authController = require("./auth.controller");

// Middlewares
const protect = require("../../middleware/authMiddleware");

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/verifyEmail", protect, authController.verifyEmail);
router.post("/resendOtp", protect, authController.resendOtp);
router.patch("/changePassword", protect, authController.changePassword);

module.exports = router;
