const lodash = require("lodash");

// Repositories
const websiteRepository = require("./website.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./website.schema");
const websiteValidation = require("./website.validation");

exports.getAllWebsites = async (filters) => {
  return websiteRepository.getAllWebsites(filters);
};

exports.getWebsitesWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [websites, totalCount] = await Promise.all([websiteRepository.getWebsitesWithPagination(filters, offset, pageSize, sort), websiteRepository.getWebsitesCount(filters)]);

  const meta = { totalCount, totalPages: Math.ceil(totalCount / pageSize), page, pageSize };

  return { data: websites, meta };
};

exports.getWebsiteById = async (payload) => {
  console.log(payload);
  const validatedPayload = joi.validate(payload, joiSchema.getWebsiteById);

  return websiteValidation.throwErrorIfWebsiteDoesNotExist(validatedPayload.workspace, validatedPayload.id);
};

exports.createWebsite = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createWebsite);

  await websiteValidation.throwErrorIfWebsiteDomainExists(validatedPayload.workspace, validatedPayload.domain);

  return websiteRepository.createWebsite(validatedPayload);
};

exports.updateWebsite = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateWebsite);

  const existingWebsite = await websiteValidation.throwErrorIfWebsiteDoesNotExist(validatedPayload.workspace, validatedPayload.id);
  const updatePayload = {};

  if (validatedPayload.title && validatedPayload.title !== existingWebsite?.title) {
    updatePayload.title = validatedPayload.title;
  }

  if (validatedPayload.domain && validatedPayload.domain !== existingWebsite?.domain) {
    updatePayload.domain = validatedPayload.domain;
  }

  if (validatedPayload.allowedDomains && !lodash.isEqual(validatedPayload.allowedDomains, existingWebsite?.allowedDomains)) {
    updatePayload.allowedDomains = validatedPayload.allowedDomains;
  }

  if (validatedPayload.status && validatedPayload.status !== existingWebsite?.status) {
    updatePayload.status = validatedPayload.status;
  }

  if (validatedPayload.verificationStatus && validatedPayload.verificationStatus !== existingWebsite?.verificationStatus) {
    updatePayload.verificationStatus = validatedPayload.verificationStatus;
  }

  if (validatedPayload.verificationToken && validatedPayload.verificationToken !== existingWebsite?.verificationToken) {
    updatePayload.verificationToken = validatedPayload.verificationToken;
  }

  if (validatedPayload.verificationMethod && validatedPayload.verificationMethod !== existingWebsite?.verificationMethod) {
    updatePayload.verificationMethod = validatedPayload.verificationMethod;
  }

  if (validatedPayload.verifiedAt && validatedPayload.verifiedAt !== existingWebsite?.verifiedAt) {
    updatePayload.verifiedAt = validatedPayload.verifiedAt;
  }

  if (validatedPayload.lastVerificationAttemptAt && validatedPayload.lastVerificationAttemptAt !== existingWebsite?.lastVerificationAttemptAt) {
    updatePayload.lastVerificationAttemptAt = validatedPayload.lastVerificationAttemptAt;
  }

  if (validatedPayload.lastVerificationError && validatedPayload.lastVerificationError !== existingWebsite?.lastVerificationError) {
    updatePayload.lastVerificationError = validatedPayload.lastVerificationError;
  }

  if (validatedPayload.settings && !lodash.isEqual(validatedPayload.settings, existingWebsite?.settings)) {
    updatePayload.settings = validatedPayload.settings;
  }

  if (validatedPayload.metadata && !lodash.isEqual(validatedPayload.metadata, existingWebsite?.metadata)) {
    updatePayload.metadata = validatedPayload.metadata;
  }

  if (!Object.keys(updatePayload).length) return existingWebsite;

  return websiteRepository.updateWebsiteById(validatedPayload.id, updatePayload);
};

exports.deleteWebsite = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.getWebsiteById);

  await websiteValidation.throwErrorIfWebsiteDoesNotExist(validatedPayload.workspace, validatedPayload.id);

  await websiteRepository.deleteWebsiteById(validatedPayload.id);

  return { deletedId: validatedPayload.id };
};
