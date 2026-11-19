const lodash = require("lodash");

// Repositories
const conversationRepository = require("./conversation.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./conversation.schema");
const conversationValidation = require("./conversation.validation");
const websiteValidation = require("../website/website.validation");
const workspaceValidation = require("../workspace/workspace.validation");

exports.getAllConversations = async (filters) => {
  return conversationRepository.getAllConversations(filters);
};

exports.getConversationsWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [conversations, totalCount] = await Promise.all([
    conversationRepository.getConversationsWithPagination(filters, offset, pageSize, sort),
    conversationRepository.getConversationsCount(filters),
  ]);

  const meta = { totalCount, totalPages: Math.ceil(totalCount / pageSize), page, pageSize };

  return { data: conversations, meta };
};

exports.getConversationById = async (conversationId) => {
  joi.validate(conversationId, joiSchema.getConversationById);

  return conversationValidation.throwErrorIfConversationDoesNotExist(conversationId);
};

exports.createConversation = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createConversation);

  await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    websiteValidation.throwErrorIfConversationDomainExistsInWorkspace(validatedPayload.domain, validatedPayload.workspace),
  ]);

  return conversationRepository.createConversation(validatedPayload);
};

exports.updateConversation = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateConversation);

  const existingConversation = await conversationValidation.throwErrorIfConversationDoesNotExist(validatedPayload.id);
  const updatePayload = {};

  if (validatedPayload.title && validatedPayload.title !== existingConversation?.title) {
    updatePayload.title = validatedPayload.title;
  }

  if (validatedPayload.domain && validatedPayload.domain !== existingConversation?.domain) {
    updatePayload.domain = validatedPayload.domain;
  }

  if (validatedPayload.allowedDomains && !lodash.isEqual(validatedPayload.allowedDomains, existingConversation?.allowedDomains)) {
    updatePayload.allowedDomains = validatedPayload.allowedDomains;
  }

  if (validatedPayload.status && validatedPayload.status !== existingConversation?.status) {
    updatePayload.status = validatedPayload.status;
  }

  if (validatedPayload.verificationStatus && validatedPayload.verificationStatus !== existingConversation?.verificationStatus) {
    updatePayload.verificationStatus = validatedPayload.verificationStatus;
  }

  if (validatedPayload.verificationToken && validatedPayload.verificationToken !== existingConversation?.verificationToken) {
    updatePayload.verificationToken = validatedPayload.verificationToken;
  }

  if (validatedPayload.verificationMethod && validatedPayload.verificationMethod !== existingConversation?.verificationMethod) {
    updatePayload.verificationMethod = validatedPayload.verificationMethod;
  }

  if (validatedPayload.verifiedAt && validatedPayload.verifiedAt !== existingConversation?.verifiedAt) {
    updatePayload.verifiedAt = validatedPayload.verifiedAt;
  }

  if (validatedPayload.lastVerificationAttemptAt && validatedPayload.lastVerificationAttemptAt !== existingConversation?.lastVerificationAttemptAt) {
    updatePayload.lastVerificationAttemptAt = validatedPayload.lastVerificationAttemptAt;
  }

  if (validatedPayload.lastVerificationError && validatedPayload.lastVerificationError !== existingConversation?.lastVerificationError) {
    updatePayload.lastVerificationError = validatedPayload.lastVerificationError;
  }

  if (validatedPayload.settings && !lodash.isEqual(validatedPayload.settings, existingConversation?.settings)) {
    updatePayload.settings = validatedPayload.settings;
  }

  if (validatedPayload.metadata && !lodash.isEqual(validatedPayload.metadata, existingConversation?.metadata)) {
    updatePayload.metadata = validatedPayload.metadata;
  }

  if (!Object.keys(updatePayload).length) return existingConversation;

  return conversationRepository.updateConversationById(validatedPayload.id, updatePayload);
};

exports.deleteConversation = async (conversationId) => {
  joi.validate(conversationId, joiSchema.getConversationById);

  await conversationValidation.throwErrorIfConversationDoesNotExist(conversationId);

  await conversationRepository.deleteConversationById(conversationId);

  return { deletedId: conversationId };
};
