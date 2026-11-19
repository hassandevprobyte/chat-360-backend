const express = require("express");
const router = express.Router();

// Controllers
const cannedResponseController = require("./cannedResponse.controller");

// Routes
router.route("/:workspaceId/message-cannedResponses").get(cannedResponseController.getCannedResponsesWithPagination).post(cannedResponseController.createCannedResponse);
router.route("/:workspaceId/message-cannedResponses/all").get(cannedResponseController.getAllCannedResponses);
router
  .route("/:workspaceId/message-cannedResponses/:cannedResponseId")
  .get(cannedResponseController.getCannedResponseById)
  .patch(cannedResponseController.updateCannedResponse)
  .delete(cannedResponseController.deleteCannedResponse);

module.exports = router;
