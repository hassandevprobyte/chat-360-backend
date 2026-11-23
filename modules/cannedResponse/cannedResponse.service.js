// Repositories
const cannedResponseRepository = require("./cannedResponse.repository");

// Validators
const joi = require("../../config/joi");
const joiSchema = require("./cannedResponse.schema");
const cannedResponseValidation = require("./cannedResponse.validation");
const userValidation = require("../user/user.validation");
const workspaceValidation = require("../workspace/workspace.validation");

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

  return cannedResponseValidation.throwErrorIfCannedResponseDoesNotExist(validatedPayload.workspace, validatedPayload.id);
};

exports.createCannedResponse = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createCannedResponse);

  await Promise.all([
    userValidation.throwErrorIfUserDoesNotExist(validatedPayload.user),
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    cannedResponseValidation.throwErrorIfCannedResponseShortcutExistsInContext(validatedPayload.workspace, validatedPayload.shortcut, validatedPayload.user),
    cannedResponseValidation.throwErrorIfMaximumNumberOfCannedResponsesReached(validatedPayload.workspace, validatedPayload.user),
  ]);

  return cannedResponseRepository.createCannedResponse(validatedPayload);
};

exports.updateCannedResponse = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateCannedResponse);

  const existingCannedResponse = await cannedResponseValidation.throwErrorIfCannedResponseDoesNotExistInContext(
    validatedPayload.workspace,
    validatedPayload.user,
    validatedPayload.id,
  );
  const updatePayload = {};

  if (validatedPayload.shortcut && validatedPayload.shortcut !== existingCannedResponse?.shortcut) {
    await cannedResponseValidation.throwErrorIfCannedResponseShortcutExistsInContext(validatedPayload.workspace, validatedPayload.user, validatedPayload.shortcut);

    updatePayload.shortcut = validatedPayload.shortcut;
  }

  if (validatedPayload.content && validatedPayload.content !== existingCannedResponse?.content) {
    updatePayload.content = validatedPayload.content;
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

  await cannedResponseValidation.throwErrorIfCannedResponseDoesNotExist(validatedPayload.workspace, validatedPayload.id);

  await cannedResponseRepository.deleteCannedResponseById(validatedPayload.id);

  return { deletedId: validatedPayload.id };
};
