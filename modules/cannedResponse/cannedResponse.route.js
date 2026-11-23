const express = require("express");
const router = express.Router();

// Controllers
const cannedResponseController = require("./cannedResponse.controller");

// Routes
router.route("/").get(cannedResponseController.getCannedResponsesWithPagination).post(cannedResponseController.createCannedResponse);
router.route("/all").get(cannedResponseController.getAllCannedResponses);
router.route("/:id").get(cannedResponseController.getCannedResponseById).patch(cannedResponseController.updateCannedResponse).delete(cannedResponseController.deleteCannedResponse);

module.exports = router;
