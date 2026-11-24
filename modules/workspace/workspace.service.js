const lodash = require("lodash");

// Services
const attachmentService = require("../attachment/attachment.service");

// Repositories
const workspaceRepository = require("./workspace.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./workspace.schema");
const workspaceValidation = require("./workspace.validation");

// Helpers
const attachmentHelpers = require("../attachment/attachment.helper");
const workspaceHelpers = require("./workspace.helper");

// Utils
const removeUploadedFiles = require("../../common/utils/removeUploadedFiles");

// Environment Variables
const { env } = require("../../config");

// Commons
const { MODELS } = require("../../common/constants");

exports.getAllWorkspaces = async (filters) => {
  return workspaceRepository.getAllWorkspaces(filters);
};

exports.getWorkspacesWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [workspaces, totalCount] = await Promise.all([
    workspaceRepository.getWorkspacesWithPagination(filters, offset, pageSize, sort),
    workspaceRepository.getWorkspacesCount(filters),
  ]);

  const meta = { totalCount, totalPages: Math.ceil(totalCount / pageSize), page, pageSize };
  return { data: workspaces, meta };
};

exports.getWorkspaceById = async (workspaceId) => {
  joi.validate(workspaceId, joiSchema.getWorkspaceById);

  return workspaceValidation.throwErrorIfWorkspaceDoesNotExist(workspaceId);
};

exports.createWorkspace = async (payload, attachmentPayload = {}) => {
  try {
    const validatedPayload = joi.validate(payload, joiSchema.createWorkspace);

    await workspaceValidation.throwErrorIfWorkspaceUserExists(validatedPayload.user);

    validatedPayload.slug = workspaceHelpers.generateWorkspaceSlug(env.WORKSPACE.SLUG_LENGTH);

    const workspace = await workspaceRepository.createWorkspace(validatedPayload);

    const updatePayload = {};
    if (attachmentPayload?.image?.length) {
      await attachmentHelpers.buildAttachmentUpdate({
        update: updatePayload,
        field: "image",
        resource: MODELS.WORKSPACE,
        resourceId: workspace._id,
        files: attachmentPayload?.image,
        uploadedBy: attachmentPayload?.uploadedBy,
      });
    }

    if (!Object.keys(updatePayload).length) return workspace;

    return workspaceRepository.updateWorkspaceById(workspace._id, updatePayload);
  } catch (error) {
    await removeUploadedFiles({ files: attachmentPayload });
    throw error;
  }
};

exports.updateWorkspace = async (payload, attachmentPayload = {}) => {
  try {
    const validatedPayload = joi.validate(payload, joiSchema.updateWorkspace);

    const existingWorkspace = await workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.id);
    const updatePayload = {};

    if (validatedPayload.title && validatedPayload.title !== existingWorkspace?.title) {
      updatePayload.title = validatedPayload.title;
    }

    if (validatedPayload.email && validatedPayload.email !== existingWorkspace?.email) {
      updatePayload.email = validatedPayload.email;
    }

    if (validatedPayload.website && validatedPayload.website !== existingWorkspace?.website) {
      updatePayload.website = validatedPayload.website;
    }

    if (validatedPayload.industry && validatedPayload.industry !== existingWorkspace?.industry) {
      updatePayload.industry = validatedPayload.industry;
    }

    if (validatedPayload.comapnySize && validatedPayload.comapnySize !== existingWorkspace?.comapnySize) {
      updatePayload.comapnySize = validatedPayload.comapnySize;
    }

    if (validatedPayload.description && validatedPayload.description !== existingWorkspace?.description) {
      updatePayload.description = validatedPayload.description;
    }

    if (validatedPayload.status && validatedPayload.status !== existingWorkspace?.status) {
      updatePayload.status = validatedPayload.status;
    }

    if (validatedPayload.agents && !lodash.isEqual(validatedPayload.agents, existingWorkspace?.agents)) {
      updatePayload.agents = validatedPayload.agents;
    }

    if (validatedPayload.settings && !lodash.isEqual(validatedPayload.settings, existingWorkspace?.settings)) {
      updatePayload.settings = validatedPayload.settings;
    }

    await attachmentHelpers.buildAttachmentUpdate({
      update: updatePayload,
      field: "image",
      resource: MODELS.WORKSPACE,
      resourceId: existingWorkspace?._id,
      removedIds: existingWorkspace?.image?._id ? [existingWorkspace.image._id] : [],
      files: attachmentPayload.image,
      uploadedBy: attachmentPayload?.uploadedBy,
    });

    if (!Object.keys(updatePayload).length) return existingWorkspace;

    return workspaceRepository.updateWorkspaceById(validatedPayload.id, updatePayload);
  } catch (error) {
    await removeUploadedFiles({ files: attachmentPayload });
    throw error;
  }
};

exports.deleteWorkspace = async (workspaceId) => {
  joi.validate(workspaceId, joiSchema.getWorkspaceById);

  await workspaceValidation.throwErrorIfWorkspaceDoesNotExist(workspaceId);
  await attachmentService.deleteAttachmentsByResource(MODELS.WORKSPACE, workspaceId);
  await workspaceRepository.deleteWorkspaceById(workspaceId);

  return { deletedId: workspaceId };
};
