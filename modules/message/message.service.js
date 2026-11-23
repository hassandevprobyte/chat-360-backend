const lodash = require("lodash");

// Repositories
const messageRepository = require("./message.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./message.schema");
const messageValidation = require("./message.validation");
const websiteValidation = require("../website/website.validation");
const workspaceValidation = require("../workspace/workspace.validation");

// Helpers
const attachmentHelpers = require("../attachment/attachment.helper");

// Constants
const { MODELS } = require("../../common/constants");

// Utils
const removeUploadedFiles = require("../../common/utils/removeUploadedFiles");

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

exports.createMessage = async (payload, attachmentPayload) => {
  try {
    const validatedPayload = joi.validate(payload, joiSchema.createMessage);

    await Promise.all([
      workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
      websiteValidation.throwErrorIfMessageDomainExistsInWorkspace(validatedPayload.domain, validatedPayload.workspace),
    ]);

    const message = await messageRepository.createMessage(validatedPayload);

    const updatePayload = {};
    if (attachmentPayload?.attachments?.length) {
      await attachmentHelpers.buildAttachmentUpdate({
        update: updatePayload,
        field: "attachments",
        resource: MODELS.MESSAGE,
        resourceId: message._id,
        files: attachmentPayload?.attachments,
        uploadedBy: attachmentPayload?.uploadedBy,
      });
    }

    if (!Object.keys(updatePayload).length) return message;

    return messageRepository.updateMessageById(message._id, updatePayload);
  } catch (error) {
    await removeUploadedFiles({ files: attachmentPayload });
    throw error;
  }
};

exports.updateMessage = async (payload, attachmentPayload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateMessage);

  const existingMessage = await messageValidation.throwErrorIfMessageDoesNotExist(validatedPayload.id);
  const updatePayload = { editedAt: new Date() };

  if (validatedPayload.sender && validatedPayload.sender !== existingMessage?.sender) {
    updatePayload.sender = validatedPayload.sender;
  }

  if (validatedPayload.type && validatedPayload.type !== existingMessage?.type) {
    updatePayload.type = validatedPayload.type;
  }

  if (validatedPayload.content && validatedPayload.content !== existingMessage?.content) {
    updatePayload.content = validatedPayload.content;
  }

  if (validatedPayload.readAt && validatedPayload.readAt !== existingMessage?.readAt) {
    updatePayload.readAt = validatedPayload.readAt;
  }

  if (validatedPayload.metadata && !lodash.isEqual(validatedPayload.metadata, existingMessage?.metadata)) {
    updatePayload.metadata = validatedPayload.metadata;
  }

  await attachmentHelpers.buildAttachmentUpdate({
    update: updatePayload,
    field: "attachments",
    resource: MODELS.MESSAGE,
    resourceId: existingMessage?._id,
    removedIds: validatedPayload.removedAttachments,
    files: attachmentPayload?.attachments,
    uploadedBy: attachmentPayload?.uploadedBy,
    existingIds: (existingMessage?.attachments || []).map((attachment) => String(attachment._id)),
  });

  if (!Object.keys(updatePayload).length) return existingMessage;

  return messageRepository.updateMessageById(validatedPayload.id, updatePayload);
};

exports.deleteMessage = async (messageId) => {
  joi.validate(messageId, joiSchema.getMessageById);

  await messageValidation.throwErrorIfMessageDoesNotExist(messageId);

  await messageRepository.deleteMessageById(messageId);

  return { deletedId: messageId };
};
