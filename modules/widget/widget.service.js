const lodash = require("lodash");

// Repositories
const widgetRepository = require("./widget.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./widget.schema");
const widgetValidation = require("./widget.validation");
const websiteValidation = require("../website/website.validation");
const workspaceValidation = require("../workspace/workspace.validation");

// Common
const generators = require("../../common/generators");

exports.getAllWidgets = async (filters) => {
  return widgetRepository.getAllWidgets(filters);
};

exports.getWidgetsWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [widgets, totalCount] = await Promise.all([widgetRepository.getWidgetsWithPagination(filters, offset, pageSize, sort), widgetRepository.getWidgetsCount(filters)]);

  const meta = { totalCount, totalPages: Math.ceil(totalCount / pageSize), page, pageSize };

  return { data: widgets, meta };
};

exports.getWidgetById = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.getWidgetById);

  return widgetValidation.throwErrorIfWidgetDoesNotExist(validatedPayload.workspace, validatedPayload.id);
};

exports.createWidget = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createWidget);

  await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    websiteValidation.throwErrorIfWebsiteDoesNotExist(validatedPayload.workspace, validatedPayload.website),
  ]);

  if (validatedPayload.isActive === true) {
    await widgetRepository.deactivateAllWidgets(validatedPayload.workspace, validatedPayload.website);
  }

  validatedPayload.publicKey = generators.generateRandomToken({ prefix: "pk", bytes: 16, encoding: "base64url" });
  validatedPayload.secretKey = generators.generateRandomToken({ prefix: "sk", bytes: 48, encoding: "base64url" });

  return widgetRepository.createWidget(validatedPayload);
};

exports.updateWidget = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateWidget);

  const existingWidget = await widgetValidation.throwErrorIfWidgetDoesNotExist(validatedPayload.workspace, validatedPayload.id);
  const updatePayload = {};

  if (validatedPayload.title && validatedPayload.title !== existingWidget?.title) {
    updatePayload.title = validatedPayload.title;
  }

  if (validatedPayload.isActive !== undefined && validatedPayload.isActive !== existingWidget?.isActive) {
    if (validatedPayload.isActive === true) {
      await widgetRepository.deactivateAllWidgets(String(existingWidget?.workspace?._id), String(existingWidget?.website?._id));
    }
    updatePayload.isActive = validatedPayload.isActive;
  }

  if (validatedPayload.settings && !lodash.isEqual(validatedPayload.settings, existingWidget?.settings)) {
    updatePayload.settings = validatedPayload.settings;
  }

  if (!Object.keys(updatePayload).length) return existingWidget;

  return widgetRepository.updateWidgetById(validatedPayload.id, updatePayload);
};

exports.deleteWidget = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.getWidgetById);

  await widgetValidation.throwErrorIfWidgetDoesNotExist(validatedPayload.workspace, validatedPayload.id);

  await widgetRepository.deleteWidgetById(validatedPayload.id);

  return { deletedId: validatedPayload.id };
};
