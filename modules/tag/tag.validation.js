const Boom = require("@hapi/boom");

// Repositories
const tagRepository = require("./tag.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfTagDoesNotExist = async (workspaceId, tagId) => {
  const tag = await tagRepository.getTagById(workspaceId, tagId);

  if (!tag) {
    throw Boom.notFound(message.error.tag.notFound);
  }

  return tag;
};

exports.throwErrorIfTagTitleExists = async (workspaceId, title) => {
  const tag = await tagRepository.getTagByTitle(workspaceId, title);

  if (tag) {
    throw Boom.notFound(message.error.tag.alreadyExists);
  }
};
