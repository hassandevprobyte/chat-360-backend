const Boom = require("@hapi/boom");

// Repositories
const conversationRepository = require("./conversation.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfConversationDoesNotExistInContextOfWorkspace = async (conversationId, workspaceId) => {
  const conversation = await conversationRepository.getConversationByIdAndWorkspaceId(conversationId, workspaceId);

  if (!conversation) {
    throw Boom.notFound(message.error.conversation.notFound);
  }

  return conversation;
};
