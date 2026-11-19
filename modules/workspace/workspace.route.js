const express = require("express");
const router = express.Router();

// Controllers
const workspaceController = require("./workspace.controller");

router.route("/").get(workspaceController.getWorkspaceById).patch(workspaceController.updateWorkspace);

module.exports = router;
