const Boom = require("@hapi/boom");

// Respositories
const cannedResponseRepository = require("./cannedResponse.repository");

// Constants
const { CANNED_RESPONSE, MESSAGE: message } = require("../../common/constants");

exports.MAX_SHORTCUTS_PER_USER = 300;

exports.throwErrorIfCannedResponseDoesNotExist = async (workspaceId, cannedResponseId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseById(workspaceId, cannedResponseId);

  if (!cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.notFound);
  }

  return cannedResponse;
};

exports.throwErrorIfCannedResponseExists = async (workspaceId, cannedResponseId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseById(workspaceId, cannedResponseId);

  if (cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.alreadyExists);
  }
};

exports.throwErrorIfCannedResponseDoesNotExistInContext = async (workspaceId, userId, cannedResponseId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseByInContext(workspaceId, userId, cannedResponseId);

  if (!cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.notFound);
  }

  return cannedResponse;
};

exports.throwErrorIfCannedResponseShortcutExistsInContext = async (workspaceId, userId, shortcut) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseByShortcutInContext(workspaceId, userId, shortcut);

  if (cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.alreadyExists);
  }
};

exports.throwErrorIfMaximumNumberOfCannedResponsesReached = async (workspaceId, userId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseCount({ workspace: workspaceId, user: userId });

  if (cannedResponse >= CANNED_RESPONSE.MAX_PER_USER) {
    throw Boom.badRequest(message.error.cannedResponse.maxPerUser);
  }
};
