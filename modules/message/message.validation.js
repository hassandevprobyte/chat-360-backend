const Boom = require("@hapi/boom");

// Repositories
const messageRepository = require("./message.repository");

// Constants
const { MESSAGE } = require("../../common/constants");

exports.throwErrorIfMessageDoesNotExist = async (messageId) => {
  const message = await messageRepository.getMessageById(messageId);

  if (!message) {
    throw Boom.notFound(MESSAGE.error.message.notFound);
  }

  return message;
};
