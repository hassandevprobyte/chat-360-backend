const Boom = require("@hapi/boom");

// Respositories
const cannedResponseRepository = require("./cannedResponse.repository");

// Constants
const { CANNED_RESPONSE, MESSAGE: message } = require("../../common/constants");

exports.MAX_SHORTCUTS_PER_USER = 300;

exports.throwErrorIfCannedResponseDoesNotExistInContextOfWorkspace = async (cannedResponseId, workspaceId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseByIdAndWorkspaceId(cannedResponseId, workspaceId);

  if (!cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.notFound);
  }

  return cannedResponse;
};

exports.throwErrorIfCannedResponseDoesNotExistInContext = async (cannedResponseId, workspaceId, userId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseByInContext(cannedResponseId, workspaceId, userId);

  if (!cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.notFound);
  }

  return cannedResponse;
};

exports.throwErrorIfCannedResponseShortcutExistsInContext = async (shortcut, workspaceId, userId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseByShortcutInContext(shortcut, workspaceId, userId);

  if (cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.alreadyExists);
  }
};

exports.throwErrorIfMaximumNumberOfCannedResponsesReachedForUserInContextOfWorkspace = async (userId, workspaceId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseCount({ user: userId, workspace: workspaceId });

  if (cannedResponse >= CANNED_RESPONSE.MAX_PER_USER) {
    throw Boom.badRequest(message.error.cannedResponse.maxPerUser);
  }
};
