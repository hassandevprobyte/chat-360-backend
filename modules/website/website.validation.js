const Boom = require("@hapi/boom");

// Repositories
const websiteRepository = require("./website.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfWebsiteDoesNotExist = async (workspaceId, websiteId) => {
  const website = await websiteRepository.getWebsiteById(workspaceId, websiteId);

  if (!website) {
    throw Boom.notFound(message.error.website.notFound);
  }

  return website;
};

exports.throwErrorIfWebsiteDomainExists = async (workspaceId, domain) => {
  const website = await websiteRepository.getWebsiteByDomain(workspaceId, domain);

  if (website) {
    throw Boom.notFound(message.error.website.domainExists);
  }
};
