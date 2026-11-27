const lodash = require("lodash");

// Repositories
const cannedResponseRepository = require("./cannedResponse.repository");

// Validators
const joi = require("../../config/joi");
const joiSchema = require("./cannedResponse.schema");
const cannedResponseValidation = require("./cannedResponse.validation");
const userValidation = require("../user/user.validation");
const workspaceValidation = require("../workspace/workspace.validation");

// Common
const { CANNED_RESPONSE } = require("../../common/constants");

exports.extractPlaceholders = (content) => {
  const placeholders = [...content.matchAll(CANNED_RESPONSE.PLACEHOLDER_REGEX)];

  return [...new Set(placeholders.map((match) => match[1]))];
};

exports.renderTemplate = (content, variables = {}) => {
  return content.replace(PLACEHOLDER_REGEX, (match, key) => {
    if (!Object.hasOwn(variables, key)) {
      return match;
    }

    const value = variables[key];

    return value == null ? "" : String(value);
  });
};

exports.getAllCannedResponses = async (filters) => {
  return cannedResponseRepository.getAllCannedResponses(filters);
};

exports.getCannedResponsesWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [cannedResponses, totalCount] = await Promise.all([
    cannedResponseRepository.getCannedResponsesWithPagination(filters, offset, pageSize, sort),
    cannedResponseRepository.getCannedResponseCount(filters),
  ]);

  const meta = {
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    page,
    pageSize,
  };

  return { data: cannedResponses, meta };
};

exports.getCannedResponseById = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.getCannedaResponseById);

  return cannedResponseValidation.throwErrorIfCannedResponseDoesNotExistInContextOfWorkspace(validatedPayload.id, validatedPayload.workspace);
};

exports.createCannedResponse = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createCannedResponse);

  await Promise.all([
    userValidation.throwErrorIfUserDoesNotExist(validatedPayload.user),
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    cannedResponseValidation.throwErrorIfCannedResponseShortcutExistsInContext(validatedPayload.shortcut, validatedPayload.workspace, validatedPayload.user),
    cannedResponseValidation.throwErrorIfMaximumNumberOfCannedResponsesReachedForUserInContextOfWorkspace(validatedPayload.user, validatedPayload.workspace),
  ]);

  validatedPayload.placeholders = exports.extractPlaceholders(validatedPayload.content);

  return cannedResponseRepository.createCannedResponse(validatedPayload);
};

exports.updateCannedResponse = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateCannedResponse);

  const existingCannedResponse = await cannedResponseValidation.throwErrorIfCannedResponseDoesNotExistInContext(
    validatedPayload.id,
    validatedPayload.workspace,
    validatedPayload.user,
  );

  const updatePayload = {};

  if (validatedPayload.title && validatedPayload.title !== existingCannedResponse?.title) {
    updatePayload.title = validatedPayload.title;
  }

  if (validatedPayload.category && validatedPayload.category !== existingCannedResponse?.category) {
    updatePayload.category = validatedPayload.category;
  }

  if (validatedPayload.visibility && validatedPayload.visibility !== existingCannedResponse?.visibility) {
    updatePayload.visibility = validatedPayload.visibility;
  }

  if (validatedPayload.tags && !lodash.isEqual(validatedPayload.tags, existingCannedResponse.tags)) {
    updatePayload.tags = validatedPayload.tags;
  }

  if (validatedPayload.shortcut && validatedPayload.shortcut !== existingCannedResponse?.shortcut) {
    await cannedResponseValidation.throwErrorIfCannedResponseShortcutExistsInContext(validatedPayload.shortcut, validatedPayload.workspace, validatedPayload.user);

    updatePayload.shortcut = validatedPayload.shortcut;
  }

  if (validatedPayload.content && validatedPayload.content !== existingCannedResponse?.content) {
    updatePayload.content = validatedPayload.content;
    updatePayload.placeholders = exports.extractPlaceholders(validatedPayload.content);
  }

  if (validatedPayload.isActive !== undefined && validatedPayload.isActive !== existingCannedResponse?.isActive) {
    updatePayload.isActive = validatedPayload.isActive;
  }

  if (validatedPayload.usageCount && validatedPayload.usageCount !== existingCannedResponse?.usageCount) {
    updatePayload.usageCount = validatedPayload.usageCount;
  }

  if (validatedPayload.lastUsedAt && validatedPayload.lastUsedAt !== existingCannedResponse?.lastUsedAt) {
    updatePayload.lastUsedAt = validatedPayload.lastUsedAt;
  }

  if (!Object.keys(updatePayload).length) return existingCannedResponse;

  return cannedResponseRepository.updateCannedResponseById(validatedPayload.id, updatePayload);
};

exports.deleteCannedResponse = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.getCannedaResponseById);

  await cannedResponseValidation.throwErrorIfCannedResponseDoesNotExistInContextOfWorkspace(validatedPayload.id, validatedPayload.workspace);

  await cannedResponseRepository.deleteCannedResponseById(validatedPayload.id);

  return { deletedId: validatedPayload.id };
};
