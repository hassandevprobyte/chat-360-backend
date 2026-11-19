const Boom = require("@hapi/boom");

// Repositories
const conversationRepository = require("./conversation.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfConversationDoesNotExist = async (conversationId) => {
  const conversation = await conversationRepository.getConversationById(conversationId);

  if (!conversation) {
    throw Boom.notFound(message.error.conversation.notFound);
  }

  return conversation;
};