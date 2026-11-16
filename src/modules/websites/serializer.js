'use strict';

function serializeWebsite(website) {
  if (!website) return null;
  return {
    id: String(website._id || website.id),
    workspaceId: String(website.workspace),
    name: website.name,
    domain: website.domain,
    allowedDomains: website.allowedDomains || [],
    status: website.status,
    settings: website.settings || {},
    verificationStatus: website.verificationStatus,
    verificationMethod: website.verificationMethod || null,
    verifiedAt: website.verifiedAt || null,
    lastVerificationAttemptAt: website.lastVerificationAttemptAt || null,
    lastVerificationError: website.lastVerificationError || null,
    createdAt: website.createdAt,
    updatedAt: website.updatedAt,
  };
}

module.exports = { serializeWebsite };
