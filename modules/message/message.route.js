const express = require("express");
const router = express.Router();

// Controllers
const messageController = require("./message.controller");

// Middlewares
const upload = uploadMiddleware({
  destination: "public/uploads/insurance",
  uploadType: "fields",
  field: [{ name: "attachments", maxCount: 10 }],
});

router.route("/").get(messageController.getMessagesWithPagination).post(upload, messageController.createMessage);
router.route("/all").get(messageController.getAllMessages);
router.route("/:id").get(messageController.getMessageById).patch(upload, messageController.updateMessage).delete(messageController.deleteMessage);

module.exports = router;
