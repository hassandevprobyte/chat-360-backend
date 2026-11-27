const Boom = require("@hapi/boom");

// Constants
const { MESSAGE, PLATFORM_ROLES, WORKSPACE_ROLES, PERMISSIONS } = require("../common/constants");

const requireWorkspaceAccess = (req, res, next) => {
  const { user, workspace } = req.context;

  if (!user || !workspace) {
    throw Boom.badRequest(MESSAGE.error.auth.forbidden);
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

  const agent = workspace?.agents.find((agent) => String(agent?.user?._id) === String(user?._id));
  if (agent) {
    req.context.workspaceAccess = {
      role: agent?.role,
      permissions: PERMISSIONS[agent?.role?.toUpperCase()],
    };

    return next();
  }

  throw Boom.forbidden(MESSAGE.error.auth.forbidden);
};

module.exports = requireWorkspaceAccess;
