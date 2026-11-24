const express = require("express");
const router = express.Router();

// Controllers
const workspaceController = require("./workspace.controller");

// Middlewares
const uploadMiddleware = require("../../middleware/uploadMiddleware");

const upload = uploadMiddleware({
  destination: "public/uploads/workspace",
  uploadType: "fields",
  field: [{ name: "image", maxCount: 1 }],
});

router.route("/").get(workspaceController.getWorkspaceById).patch(upload, workspaceController.updateWorkspace);

module.exports = router;
