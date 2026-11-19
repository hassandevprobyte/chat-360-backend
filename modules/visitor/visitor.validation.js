const Boom = require("@hapi/boom");

// Repositories
const visitorRepository = require("./visitor.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfVisitorDoesNotExist = async (visitorId) => {
  const visitor = await visitorRepository.getVisitorById(visitorId);

  if (!visitor) {
    throw Boom.notFound(message.error.visitor.notFound);
  }

  return visitor;
};
