const Boom = require("@hapi/boom");
const jwt = require("jsonwebtoken");

// Repositories
const visitorRepository = require("../modules/visitor/visitor.repository");

// Validations
const userValidation = require("../modules/user/user.validation");
const workspaceValidation = require("../modules/workspace/workspace.validation");
const websiteValidation = require("../modules/website/website.validation");

// Helpers
const widgetHelpers = require("../modules/widget/widget.helper");
const visitorHelpers = require("../modules/visitor/visitor.helper");

// Events
const { ROOMS } = require("./events");

// Environment Variables
const env = require("../config/env");

// Constants
const { MESSAGE, PERMISSIONS, PLATFORM_ROLES, STATUSES, TYPES, WORKSPACE_ROLES } = require("../common/constants");

async function authenticateDashboard(socket) {
  const { accessToken, slug } = socket.handshake.auth;

  if (!accessToken || !slug) {
    throw Boom.unauthorized(MESSAGE.error.auth.forbidden);
  }

  const [scheme, token] = accessToken.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw Boom.unauthorized(MESSAGE.error.auth.forbidden);
  }

  const decoded = jwt.verify(token, env.JWT.ACCESS_TOKEN_SECRET);

  const user = await userValidation.throwErrorIfUserDoesNotExist(decoded.id);

  if (!user.isActive) {
    throw Boom.forbidden(MESSAGE.error.auth.accessDenied);
  }

  const workspace = await workspaceValidation.throwErrorIfWorkspaceSlugDoesNotExist(slug);

  if (workspace.status !== STATUSES.WORKSPACE.ACTIVE) {
    throw Boom.forbidden(MESSAGE.error.workspace.currentStatus(workspace.status));
  }

  socket.data = {
    user,
    type: TYPES.SOCKET.DASHBOARD,
    workspace: workspace,
    workspaceAccess: null,
  };

  await joinWorkspace(socket);
}

async function joinWorkspace(socket) {
  const { user, workspace } = socket.data;

  if (user.platformRole === PLATFORM_ROLES.SUPER_ADMIN) {
    socket.data.workspaceAccess = {
      role: PLATFORM_ROLES.SUPER_ADMIN,
      permissions: PERMISSIONS.SUPER_ADMIN,
    };
  }

  if (String(workspace?.user?._id) === String(user?._id)) {
    socket.data.workspaceAccess = {
      role: WORKSPACE_ROLES.OWNER,
      permissions: PERMISSIONS.OWNER,
    };
  }

  const isAgent = workspace.agents.find((item) => String(item?.user._id) === String(user?._id));
  if (isAgent) {
    socket.data.workspaceAccess = {
      role: WORKSPACE_ROLES.AGENT,
      permissions: PERMISSIONS.AGENT,
    };
  }

  await socket.join(ROOMS.workspace(workspace.slug));

  return {
    workspaceAccess,
  };
}

async function authenticateWidget(socket) {
  const { token } = socket.handshake.auth || {};

  if (!token) {
    throw Boom.unauthorized(MESSAGE.error.auth.forbidden);
  }

  const payload = visitorHelpers.verifyVisitorToken(token);

  const { widget, website, workspace } = await widgetHelpers.resolveByIds(payload);

  const originHost = widgetHelpers.requestOriginHost({
    get: (header) => socket.handshake.headers[header.toLowerCase()],
  });

  await websiteValidation.throeErrorIfAllowedDomainDoesNotExist(String(website._id), originHost);

  const visitor = await visitorRepository.findOneInWorkspace(workspace._id, payload.sub);

  if (!visitor || visitor.anonymousId !== payload.aid) {
    throw Boom.unauthorized("Visitor session is no longer valid");
  }

  socket.data = {
    visitor,
    workspace,
    website,
    widget,
    type: TYPES.SOCKET.WIDGET,
  };
}

async function socketAuth(socket, next) {
  try {
    const { type } = socket.handshake.auth;

    switch (type) {
      case TYPES.SOCKET.DASHBOARD:
        await authenticateDashboard(socket);
        break;

      case TYPES.SOCKET.WIDGET:
        await authenticateWidget(socket);
        break;

      default:
        throw Boom.unauthorized(MESSAGE.error.auth.forbidden);
    }

    return next();
  } catch (err) {
    console.log(error);

    throw Boom.unauthorized(MESSAGE.error.auth.unauthorized);
  }
}

module.exports = { socketAuth, joinWorkspace };
