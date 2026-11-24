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

router.route("/").get(workspaceController.getWorkspacesWithPagination).post(upload, workspaceController.createWorkspace);
router.route("/all").get(workspaceController.getAllWorkspaces);
router.route("/:id").patch(upload, workspaceController.updateWorkspace).delete(workspaceController.deleteWorkspace);

module.exports = router;
