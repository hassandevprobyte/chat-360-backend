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

exports.getCannedResponseById = async (cannedResponseId) => {
  joi.validate(cannedResponseId, joiSchema.getCannedaResponseById);

  return cannedResponseValidation.throwErrorIfCannedResponseDoesNotExist(cannedResponseId);
};

exports.createCannedResponse = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createCannedResponse);

  await Promise.all([
    userValidation.throwErrorIfUserDoesNotExist(validatedPayload.user),
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    cannedResponseValidation.throwErrorIfCannedResponseShortcutExistsInContext(validatedPayload.shortcut, validatedPayload.workspace, validatedPayload.user),
    cannedResponseValidation.throwErrorIfMaximumCannedResponsesPerUserReached(validatedPayload.workspace, validatedPayload.user),
  ]);

  return cannedResponseRepository.createCannedResponse(validatedPayload);
};

exports.updateCannedResponse = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateCannedResponse);

  const existingcannedResponse = await cannedResponseValidation.throwErrorIfCannedResponseDoesNotExist(validatedPayload.id);
  const updatePayload = {};

  if (validatedPayload.shortcut && validatedPayload.shortcut !== existingcannedResponse?.shortcut) {
    await cannedResponseValidation.throwErrorIfCannedResponseShortcutExistsInContext(
      validatedPayload.shortcut,
      String(existingcannedResponse?.workspace?._id),
      String(existingcannedResponse?.user?._id),
    );
    updatePayload.shortcut = validatedPayload.shortcut;
  }

  if (validatedPayload.content && validatedPayload.content !== existingcannedResponse?.content) {
    updatePayload.content = validatedPayload.content;
  }

  if (validatedPayload.isActive !== undefined && validatedPayload.isActive !== existingcannedResponse?.isActive) {
    updatePayload.isActive = validatedPayload.isActive;
  }

  if (validatedPayload.usageCount && validatedPayload.usageCount !== existingcannedResponse?.usageCount) {
    updatePayload.usageCount = validatedPayload.usageCount;
  }

  if (validatedPayload.lastUsedAt && validatedPayload.lastUsedAt !== existingcannedResponse?.lastUsedAt) {
    updatePayload.lastUsedAt = validatedPayload.lastUsedAt;
  }

  if (!Object.keys(updatePayload).length) return existingcannedResponse;

  return cannedResponseRepository.updateCannedResponseById(validatedPayload.id, updatePayload);
};

exports.deleteCannedResponse = async (cannedResponseId) => {
  joi.validate(cannedResponseId, joiSchema.getCannedaResponseById);

  await cannedResponseValidation.throwErrorIfCannedResponseDoesNotExist(cannedResponseId);

  await cannedResponseRepository.deleteCannedResponseById(cannedResponseId);

  return { deletedId: cannedResponseId };
};
