const Boom = require("@hapi/boom");

// Constants
const { MESSAGE, PERMISSIONS, PLATFORM_ROLES } = require("../common/constants");

const METHOD_TO_ACTION = Object.freeze({
  GET: "READ",
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
});

const checkPermissions = (resource) => (req, res, next) => {
  const { user, workspaceAccess } = req.context;

  if (!user || !workspaceAccess) {
    throw Boom.forbidden(MESSAGE.error.auth.forbidden);
  }

  if (user.platformRole === PLATFORM_ROLES.SUPER_ADMIN) {
    return next();
  }

  const action = METHOD_TO_ACTION[req.method];

  if (!action) {
    throw Boom.forbidden(MESSAGE.error.auth.forbidden);
  }

  const role = workspaceAccess.role?.toUpperCase();
  const permissions = PERMISSIONS[role]?.[resource] || [];

  if (permissions.includes(action)) {
    return next();
  }

  throw Boom.forbidden(MESSAGE.error.auth.forbidden);
};

module.exports = checkPermissions;
