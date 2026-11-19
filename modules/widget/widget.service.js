const lodash = require("lodash");

// Repositories
const widgetRepository = require("./widget.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./widget.schema");
const widgetValidation = require("./widget.validation");
const websiteValidation = require("../website/website.validation");
const workspaceValidation = require("../workspace/workspace.validation");

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

exports.getWidgetById = async (widgetId) => {
  joi.validate(widgetId, joiSchema.getWidgetById);

  return widgetValidation.throwErrorIfWidgetDoesNotExist(widgetId);
};

exports.createWidget = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createWidget);

  await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    websiteValidation.throwErrorIfWebsiteDoesNotExist(validatedPayload.website),
  ]);

  if (validatedPayload.isActive === true) {
    await widgetRepository.deactivateAllWidgets(validatedPayload.workspace, validatedPayload.website);
  }

  return widgetRepository.createWidget(validatedPayload);
};

exports.updateWidget = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateWidget);

  const existingWidget = await widgetValidation.throwErrorIfWidgetDoesNotExist(validatedPayload.id);
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

exports.deleteWidget = async (widgetId) => {
  joi.validate(widgetId, joiSchema.getWidgetById);

  await widgetValidation.throwErrorIfWidgetDoesNotExist(widgetId);

  await widgetRepository.deleteWidgetById(widgetId);

  return { deletedId: widgetId };
};
