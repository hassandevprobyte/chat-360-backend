const express = require("express");
const router = express.Router();

// Controllers
const publicController = require("./public.controller");

// Middlewares
const uploadMiddleware = require("../../middleware/uploadMiddleware");

const upload = uploadMiddleware({
  destination: "public/uploads/message",
  uploadType: "fields",
  field: [{ name: "attachments", maxCount: 10 }],
});

router.route("/").post(publicController.createVisitor);

module.exports = router;
