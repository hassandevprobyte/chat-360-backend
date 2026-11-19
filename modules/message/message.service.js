const lodash = require("lodash");

// Repositories
const messageRepository = require("./message.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./message.schema");
const messageValidation = require("./message.validation");
const websiteValidation = require("../website/website.validation");
const workspaceValidation = require("../workspace/workspace.validation");

exports.getAllMessages = async (filters) => {
  return messageRepository.getAllMessages(filters);
};

exports.getMessagesWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [messages, totalCount] = await Promise.all([messageRepository.getMessagesWithPagination(filters, offset, pageSize, sort), messageRepository.getMessagesCount(filters)]);

  const meta = { totalCount, totalPages: Math.ceil(totalCount / pageSize), page, pageSize };

  return { data: messages, meta };
};

exports.getMessageById = async (messageId) => {
  joi.validate(messageId, joiSchema.getMessageById);

  return messageValidation.throwErrorIfMessageDoesNotExist(messageId);
};

exports.createMessage = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createMessage);

  await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    websiteValidation.throwErrorIfMessageDomainExistsInWorkspace(validatedPayload.domain, validatedPayload.workspace),
  ]);

  return messageRepository.createMessage(validatedPayload);
};

exports.updateMessage = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateMessage);

  const existingMessage = await messageValidation.throwErrorIfMessageDoesNotExist(validatedPayload.id);
  const updatePayload = {};

  if (validatedPayload.title && validatedPayload.title !== existingMessage?.title) {
    updatePayload.title = validatedPayload.title;
  }

  if (validatedPayload.domain && validatedPayload.domain !== existingMessage?.domain) {
    updatePayload.domain = validatedPayload.domain;
  }

  if (validatedPayload.allowedDomains && !lodash.isEqual(validatedPayload.allowedDomains, existingMessage?.allowedDomains)) {
    updatePayload.allowedDomains = validatedPayload.allowedDomains;
  }

  if (validatedPayload.status && validatedPayload.status !== existingMessage?.status) {
    updatePayload.status = validatedPayload.status;
  }

  if (validatedPayload.verificationStatus && validatedPayload.verificationStatus !== existingMessage?.verificationStatus) {
    updatePayload.verificationStatus = validatedPayload.verificationStatus;
  }

  if (validatedPayload.verificationToken && validatedPayload.verificationToken !== existingMessage?.verificationToken) {
    updatePayload.verificationToken = validatedPayload.verificationToken;
  }

  if (validatedPayload.verificationMethod && validatedPayload.verificationMethod !== existingMessage?.verificationMethod) {
    updatePayload.verificationMethod = validatedPayload.verificationMethod;
  }

  if (validatedPayload.verifiedAt && validatedPayload.verifiedAt !== existingMessage?.verifiedAt) {
    updatePayload.verifiedAt = validatedPayload.verifiedAt;
  }

  if (validatedPayload.lastVerificationAttemptAt && validatedPayload.lastVerificationAttemptAt !== existingMessage?.lastVerificationAttemptAt) {
    updatePayload.lastVerificationAttemptAt = validatedPayload.lastVerificationAttemptAt;
  }

  if (validatedPayload.lastVerificationError && validatedPayload.lastVerificationError !== existingMessage?.lastVerificationError) {
    updatePayload.lastVerificationError = validatedPayload.lastVerificationError;
  }

  if (validatedPayload.settings && !lodash.isEqual(validatedPayload.settings, existingMessage?.settings)) {
    updatePayload.settings = validatedPayload.settings;
  }

  if (validatedPayload.metadata && !lodash.isEqual(validatedPayload.metadata, existingMessage?.metadata)) {
    updatePayload.metadata = validatedPayload.metadata;
  }

  if (!Object.keys(updatePayload).length) return existingMessage;

  return messageRepository.updateMessageById(validatedPayload.id, updatePayload);
};

exports.deleteMessage = async (messageId) => {
  joi.validate(messageId, joiSchema.getMessageById);

  await messageValidation.throwErrorIfMessageDoesNotExist(messageId);

  await messageRepository.deleteMessageById(messageId);

  return { deletedId: messageId };
};
