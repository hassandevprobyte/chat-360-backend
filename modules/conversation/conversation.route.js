const express = require("express");
const router = express.Router();

// Controllers
const conversationController = require("./conversation.controller");

router.route("/").get(conversationController.getConversationsWithPagination).post(conversationController.createConversation);
router.route("/all").get(conversationController.getAllConversations);
router.route("/:id").get(conversationController.getConversationById).patch(conversationController.updateConversation).delete(conversationController.deleteConversation);

module.exports = router;
