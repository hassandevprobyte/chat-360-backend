const Boom = require("@hapi/boom");

// Repositories
const websiteRepository = require("./website.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfWebsiteDoesNotExistInContextOfWorkspace = async (websiteId, workspaceId) => {
  const website = await websiteRepository.getWebsiteByIdAndWorkspaceId(websiteId, workspaceId);

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

exports.throeErrorIfAllowedDomainDoesNotExist = async (websiteId, domain) => {
  const website = await websiteRepository.getWebsiteByIdAndAllowedDomain(websiteId, domain);

  if (!website) {
    throw Boom.notFound(message.error.website.allowedDomainNotFound);
  }

  return website;
};
