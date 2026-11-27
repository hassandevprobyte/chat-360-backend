const Boom = require("@hapi/boom");

// Repositories
const visitorRepository = require("./visitor.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfVisitorDoesNotExistInContextOfWorkspace = async (visitorId, workspaceId) => {
  const visitor = await visitorRepository.getVisitorByIdAndWorkspaceId(visitorId, workspaceId);

  if (!visitor) {
    throw Boom.notFound(message.error.visitor.notFound);
  }

  return visitor;
};

exports.throwErrorIfVisitorAnonymousIdExistsInContextOfWorkspace = async (workspaceId, anonymousId) => {
  const visitor = await visitorRepository.getVisitorByWorkspaceIdAndAnonymousId(workspaceId, anonymousId);

  if (!visitor) {
    throw Boom.notFound(message.error.visitor.notFound);
  }

  return visitor;
};
