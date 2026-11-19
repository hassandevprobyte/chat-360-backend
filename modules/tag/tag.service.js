// Repositories
const tagRepository = require("./tag.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./tag.schema");
const tagValidation = require("./tag.validation");
const workspaceValidation = require("../workspace/workspace.validation");

exports.getAllTags = async (filters) => {
  return tagRepository.getAllTags(filters);
};

exports.getTagsWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [tags, totalCount] = await Promise.all([tagRepository.getTagsWithPagination(filters, offset, pageSize, sort), tagRepository.getTagsCount(filters)]);

  const meta = { totalCount, totalPages: Math.ceil(totalCount / pageSize), page, pageSize };

  return { data: tags, meta };
};

exports.getTagById = async (tagId) => {
  joi.validate(tagId, joiSchema.getTagById);

  return tagValidation.throwErrorIfTagDoesNotExist(tagId);
};

exports.createTag = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createTag);

  await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    tagValidation.throwErrorIfTagTitleKeyExists(validatedPayload.titleKey, validatedPayload.workspace),
  ]);

  return tagRepository.createTag(validatedPayload);
};

exports.updateTag = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateTag);

  const existinhTag = await tagValidation.throwErrorIfTagDoesNotExist(validatedPayload.id);
  const updatePayload = {};

  if (validatedPayload.title && validatedPayload.title !== existinhTag?.title) {
    updatePayload.title = validatedPayload.title;
  }

  if (validatedPayload.titleKey && validatedPayload.titleKey !== existinhTag?.titleKey) {
    await tagValidation.throwErrorIfTagTitleKeyExists(validatedPayload.titleKey, String(existinhTag?.workspace?._id));
    updatePayload.titleKey = validatedPayload.titleKey;
  }

  if (validatedPayload.color !== undefined && validatedPayload.color !== existinhTag?.color) {
    updatePayload.color = validatedPayload.color;
  }

  if (validatedPayload.description && validatedPayload.description !== existinhTag?.description) {
    updatePayload.description = validatedPayload.description;
  }

  if (validatedPayload.isActive !== undefined && validatedPayload.isActive !== existinhTag?.isActive) {
    updatePayload.isActive = validatedPayload.isActive;
  }

  if (validatedPayload.metadata && validatedPayload.metadata !== existinhTag?.metadata) {
    updatePayload.metadata = validatedPayload.metadata;
  }

  if (!Object.keys(updatePayload).length) return existinhTag;

  return tagRepository.updateTagById(validatedPayload.id, updatePayload);
};

exports.deleteTag = async (tagId) => {
  joi.validate(tagId, joiSchema.getTagById);

  await tagValidation.throwErrorIfTagDoesNotExist(tagId);

  await tagRepository.deleteTagById(tagId);

  return { deletedId: tagId };
};
