const lodash = require("lodash");

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

exports.getTagById = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.getTagById);

  return tagValidation.throwErrorIfTagDoesNotExist(validatedPayload.workspace, validatedPayload.id);
};

exports.createTag = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createTag);

  await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    tagValidation.throwErrorIfTagTitleExists(validatedPayload.workspace, validatedPayload.title),
  ]);

  validatedPayload.titleKey = `#${validatedPayload.title}`;

  return tagRepository.createTag(validatedPayload);
};

exports.updateTag = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateTag);

  const existinhTag = await tagValidation.throwErrorIfTagDoesNotExist(validatedPayload.workspace, validatedPayload.id);
  const updatePayload = {};

  if (validatedPayload.title && validatedPayload.title !== existinhTag?.title) {
    await tagValidation.throwErrorIfTagTitleExists(String(existinhTag?.workspace?._id), validatedPayload.title);
    updatePayload.title = validatedPayload.title;
    updatePayload.titleKey = `#${validatedPayload.title}`;
  }

  if (validatedPayload.color && validatedPayload.color !== existinhTag?.color) {
    updatePayload.color = validatedPayload.color;
  }

  if (validatedPayload.description && validatedPayload.description !== existinhTag?.description) {
    updatePayload.description = validatedPayload.description;
  }

  if (validatedPayload.isActive !== undefined && validatedPayload.isActive !== existinhTag?.isActive) {
    updatePayload.isActive = validatedPayload.isActive;
  }

  if (validatedPayload.metadata && !lodash.isEqual(validatedPayload.metadata, existinhTag?.metadata)) {
    updatePayload.metadata = validatedPayload.metadata;
  }

  if (!Object.keys(updatePayload).length) return existinhTag;

  return tagRepository.updateTagById(validatedPayload.id, updatePayload);
};

exports.deleteTag = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.getTagById);

  await tagValidation.throwErrorIfTagDoesNotExist(validatedPayload.workspace, validatedPayload.id);

  await tagRepository.deleteTagById(validatedPayload.id);

  return { deletedId: validatedPayload.id };
};
