const Boom = require("@hapi/boom");

// Repositories
const tagRepository = require("./tag.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfTagDoesNotExistInContextOfWorkspace = async (tagId, workspaceId) => {
  const tag = await tagRepository.getTagByIdAndWorkspaceId(tagId, workspaceId);

  if (!tag) {
    throw Boom.notFound(message.error.tag.notFound);
  }

  return tag;
};

exports.throwErrorIfTagTitleExistsInContextOfWorkspace = async (title, workspaceId) => {
  const tag = await tagRepository.getTagByTitleAndWorkspaceId(title, workspaceId);

  if (tag) {
    throw Boom.notFound(message.error.tag.alreadyExists);
  }
};
