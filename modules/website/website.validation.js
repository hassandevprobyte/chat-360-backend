const Boom = require("@hapi/boom");

// Repositories
const websiteRepository = require("./website.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfWebsiteDoesNotExist = async (websiteId) => {
  const website = await websiteRepository.getWebsiteById(websiteId);

  if (!website) {
    throw Boom.notFound(message.error.website.notFound);
  }

  return website;
};

exports.throwErrorIfWebsiteDomainExistsInWorkspace = async (domain, workspaceId) => {
  const website = await websiteRepository.getWebsiteByDomainAndWorkspaceId(domain, workspaceId);

  if (website) {
    throw Boom.notFound(message.error.website.alreadyExists);
  }
};
