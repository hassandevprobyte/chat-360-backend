const Boom = require("@hapi/boom");

// Respositories
const cannedResponseRepository = require("./cannedResponse.repository");

// Constants
const { CANNED_RESPONSE, MESSAGE: message } = require("../../common/constants");

exports.MAX_SHORTCUTS_PER_USER = 300;

exports.throwErrorIfCannedResponseDoesNotExist = async (cannedResponseId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseById(cannedResponseId);

  if (!cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.notFound);
  }

  return cannedResponse;
};

exports.throwErrorIfCannedResponseExists = async (cannedResponseId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseById(cannedResponseId);

  if (cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.alreadyExists);
  }
};

exports.throwErrorIfCannedResponseShortcutExistsInContext = async (shortcut, workspaceId, userId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseByShortcutInContext(shortcut, workspaceId, userId);

  if (cannedResponse) {
    throw Boom.notFound(message.error.cannedResponse.alreadyExists);
  }
};

exports.throwErrorIfMaximumCannedResponsesPerUserReached = async (workspaceId, userId) => {
  const cannedResponse = await cannedResponseRepository.getCannedResponseCount({ workspace: workspaceId, user: userId });

  if (cannedResponse >= CANNED_RESPONSE.MAX_PER_USER) {
    throw Boom.badRequest(message.error.cannedResponse.maxPerUser);
  }
};
