const Boom = require("@hapi/boom");

// Repositories
const tagRepository = require("./tag.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfTagDoesNotExist = async (tagId) => {
  const tag = await tagRepository.getTagById(tagId);

  if (!tag) {
    throw Boom.notFound(message.error.tag.notFound);
  }

  return tag;
};

exports.throwErrorIfTagTitleKeyExists = async (titleKey, workspaceId) => {
  const tag = await tagRepository.getTagByTitleKeyAndWorkspaceId(titleKey, workspaceId);

  if (tag) {
    throw Boom.notFound(message.error.tag.alreadyExists);
  }
};
