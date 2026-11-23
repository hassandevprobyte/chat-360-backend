const Boom = require("@hapi/boom");
const asyncHandler = require("express-async-handler");

// Validations
const workspaceValidation = require("../modules/workspace/workspace.validation");

// Constants
const { MESSAGE, STATUSES } = require("../common/constants");

const requireWorkspaceContext = asyncHandler(async (req, res, next) => {
  if (!req.params.slug) {
    throw Boom.badRequest("Workspace slug is required");
  }

  const workspace = await workspaceValidation.throwErrorIfWorkspaceSlugDoesNotExist(req.params.slug);

  if (workspace.status !== STATUSES.WORKSPACE.ACTIVE) {
    throw Boom.forbidden(MESSAGE.error.workspace.currentStatus(workspace.status));
  }

  req.context.workspace = workspace;

  next();
});

module.exports = requireWorkspaceContext;
