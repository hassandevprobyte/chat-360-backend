const Boom = require("@hapi/boom");
const express = require("express");
const router = express.Router();

// Middlewares
const { authLimiter, publicLimiter } = require("../middleware/rateLimiter");
const checkPermissions = require("../middleware/checkPermissions");
const protect = require("../middleware/authMiddleware");
const queryFilters = require("../middleware/queryFilters");
const requireSuperAdminAccess = require("../middleware/requireSuperAdminAccess");
const requireWorkspaceContext = require("../middleware/requireWorkspaceContext");
const requireWorkspaceAccess = require("../middleware/requireWorkspaceAccess");

// Constants
const { MODELS } = require("../common/constants");

// Admin routes
const adminRoutes = [
  { path: "/users", resource: MODELS.USER, route: require("./user/user.route") },
  { path: "/workspaces", resource: MODELS.WORKSPACE, route: require("./workspace/workspace.admin.route") },
];

// Workspace routes
const workspaceRoutes = [
  { path: "/", resource: MODELS.WORKSPACE, route: require("./workspace/workspace.route") },
  { path: "/attachments", resource: MODELS.ATTACHMENT, route: require("./attachment/attachment.route") },
  // { path: "/picklists", resource: MODELS.PICKLIST, route: require("./picklist/picklist.route") },
  { path: "/canned-responses", resource: MODELS.CANNED_RESPONSE, route: require("./cannedResponse/cannedResponse.route") },
  { path: "/conversations", resource: MODELS.CONVERSATION, route: require("./conversation/conversation.route") },
  { path: "/messages", resource: MODELS.MESSAGE, route: require("./message/message.route") },
  { path: "/roles", resource: MODELS.ROLE, route: require("./role/role.route") },
  { path: "/tags", resource: MODELS.TAG, route: require("./tag/tag.route") },
  { path: "/users", resource: MODELS.USER, route: require("./user/user.route") },
  { path: "/visitors", resource: MODELS.VISITOR, route: require("./visitor/visitor.route") },
  { path: "/websites", resource: MODELS.WEBSITE, route: require("./website/website.route") },
  { path: "/widgets", resource: MODELS.WIDGET, route: require("./widget/widget.route") },
];

// Route registration helper
const registerRoutes = (routes, { permissions = false } = {}) => {
  const childRouter = express.Router({ mergeParams: true });

  routes.forEach(({ path, resource, route }) => {
    if (!path || !resource || !route) {
      throw Boom.conflict("Invalid route");
    }

    const middlewares = [];

    if (permissions) {
      middlewares.push(checkPermissions(resource));
    }

    middlewares.push(queryFilters(resource));

    childRouter.use(path, ...middlewares, route);
  });

  return childRouter;
};

router.use("/auth", authLimiter, require("./auth/auth.route"));
router.use("/admin", protect, requireSuperAdminAccess, registerRoutes(adminRoutes));
router.use("/admin/:slug", protect, requireSuperAdminAccess, requireWorkspaceContext, requireWorkspaceAccess, registerRoutes(workspaceRoutes, { permissions: true }));
router.use("/:slug", protect, requireWorkspaceContext, requireWorkspaceAccess, registerRoutes(workspaceRoutes, { permissions: true }));
router.use("/public", publicLimiter, require("./public/public.route"));

module.exports = router;
