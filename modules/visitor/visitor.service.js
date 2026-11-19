const lodash = require("lodash");

// Repositories
const visitorRepository = require("./visitor.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./visitor.schema");
const visitorValidation = require("./visitor.validation");
const websiteValidation = require("../website/website.validation");
const workspaceValidation = require("../workspace/workspace.validation");

exports.getAllVisitors = async (filters) => {
  return visitorRepository.getAllVisitors(filters);
};

exports.getVisitorsWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [visitors, totalCount] = await Promise.all([visitorRepository.getVisitorsWithPagination(filters, offset, pageSize, sort), visitorRepository.getVisitorsCount(filters)]);

  const meta = { totalCount, totalPages: Math.ceil(totalCount / pageSize), page, pageSize };

  return { data: visitors, meta };
};

exports.getVisitorById = async (visitorId) => {
  joi.validate(visitorId, joiSchema.getVisitorById);

  return visitorValidation.throwErrorIfVisitorDoesNotExist(visitorId);
};

// TODO: Finish it
exports.createVisitor = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createVisitor);

  await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    websiteValidation.throwErrorIfWebsiteDoesNotExist(validatedPayload.website),
  ]);

  return visitorRepository.createVisitor(validatedPayload);
};

// TODO: Finish it
exports.updateVisitor = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateVisitor);

  const existingVisitor = await visitorValidation.throwErrorIfVisitorDoesNotExist(validatedPayload.id);
  const updatePayload = {};

  if (validatedPayload.title && validatedPayload.title !== existingVisitor?.title) {
    updatePayload.title = validatedPayload.title;
  }

  if (validatedPayload.domain && validatedPayload.domain !== existingVisitor?.domain) {
    updatePayload.domain = validatedPayload.domain;
  }

  if (validatedPayload.allowedDomains && !lodash.isEqual(validatedPayload.allowedDomains, existingVisitor?.allowedDomains)) {
    updatePayload.allowedDomains = validatedPayload.allowedDomains;
  }

  if (validatedPayload.status && validatedPayload.status !== existingVisitor?.status) {
    updatePayload.status = validatedPayload.status;
  }

  if (validatedPayload.verificationStatus && validatedPayload.verificationStatus !== existingVisitor?.verificationStatus) {
    updatePayload.verificationStatus = validatedPayload.verificationStatus;
  }

  if (validatedPayload.verificationToken && validatedPayload.verificationToken !== existingVisitor?.verificationToken) {
    updatePayload.verificationToken = validatedPayload.verificationToken;
  }

  if (validatedPayload.verificationMethod && validatedPayload.verificationMethod !== existingVisitor?.verificationMethod) {
    updatePayload.verificationMethod = validatedPayload.verificationMethod;
  }

  if (validatedPayload.verifiedAt && validatedPayload.verifiedAt !== existingVisitor?.verifiedAt) {
    updatePayload.verifiedAt = validatedPayload.verifiedAt;
  }

  if (validatedPayload.lastVerificationAttemptAt && validatedPayload.lastVerificationAttemptAt !== existingVisitor?.lastVerificationAttemptAt) {
    updatePayload.lastVerificationAttemptAt = validatedPayload.lastVerificationAttemptAt;
  }

  if (validatedPayload.lastVerificationError && validatedPayload.lastVerificationError !== existingVisitor?.lastVerificationError) {
    updatePayload.lastVerificationError = validatedPayload.lastVerificationError;
  }

  if (validatedPayload.settings && !lodash.isEqual(validatedPayload.settings, existingVisitor?.settings)) {
    updatePayload.settings = validatedPayload.settings;
  }

  if (validatedPayload.metadata && !lodash.isEqual(validatedPayload.metadata, existingVisitor?.metadata)) {
    updatePayload.metadata = validatedPayload.metadata;
  }

  if (!Object.keys(updatePayload).length) return existingVisitor;

  return visitorRepository.updateVisitorById(validatedPayload.id, updatePayload);
};

exports.deleteVisitor = async (visitorId) => {
  joi.validate(visitorId, joiSchema.getVisitorById);

  await visitorValidation.throwErrorIfVisitorDoesNotExist(visitorId);

  await visitorRepository.deleteVisitorById(visitorId);

  return { deletedId: visitorId };
};
