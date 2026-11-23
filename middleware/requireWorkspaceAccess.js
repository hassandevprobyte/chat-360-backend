const Boom = require("@hapi/boom");

// Constants
const { MESSAGE: message, PLATFORM_ROLES, WORKSPACE_ROLES, PERMISSIONS } = require("../common/constants");

const requireWorkspaceAccess = (req, res, next) => {
  const { user, workspace } = req.context;

  if (!user || !workspace) {
    throw Boom.badRequest(message.error.auth.forbidden);
  }

  if (user.platformRole === PLATFORM_ROLES.SUPER_ADMIN) {
    req.context.workspaceAccess = {
      role: PLATFORM_ROLES.SUPER_ADMIN,
      permissions: PERMISSIONS.SUPER_ADMIN,
    };

    return next();
  }

  if (String(workspace?.user?._id) === String(user?._id)) {
    req.context.workspaceAccess = {
      role: WORKSPACE_ROLES.OWNER,
      permissions: PERMISSIONS.OWNER,
    };

    return next();
  }

  const isAgent = workspace?.agents.find((agent) => String(agent?.user?._id) === String(user?._id));
  if (isAgent) {
    req.context.workspaceAccess = {
      role: WORKSPACE_ROLES.AGENT,
      permissions: PERMISSIONS.AGENT,
    };

    return next();
  }

  throw Boom.forbidden(message.error.auth.forbidden);
};

module.exports = requireWorkspaceAccess;
