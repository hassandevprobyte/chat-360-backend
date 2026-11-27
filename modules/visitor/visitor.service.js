const lodash = require("lodash");

// Repositories
const visitorRepository = require("./visitor.repository");

// Validations
const joi = require("../../config/joi");
const joiSchema = require("./visitor.schema");
const visitorValidation = require("./visitor.validation");
const websiteValidation = require("../website/website.validation");
const workspaceValidation = require("../workspace/workspace.validation");
const widgetValidation = require("../widget/widget.validation");

// Common
const generators = require("../../common/generators");

exports.getAllVisitors = async (filters) => {
  return visitorRepository.getAllVisitors(filters);
};

exports.getVisitorsWithPagination = async (payload) => {
  const { filters, page, pageSize, sort } = payload;
  const offset = (page - 1) * pageSize;

  const [visitors, totalCount] = await Promise.all([visitorRepository.getVisitorsWithPagination(filters, offset, pageSize, sort), visitorRepository.getVisitorsCount(filters)]);

  const meta = { totalCount, totalPages: Math.ceil(totalCount / pageSize), page, pageSize };

  return { data: visitors, meta };
};

exports.getVisitorById = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.getVisitorById);

  return visitorValidation.throwErrorIfVisitorDoesNotExistInContextOfWorkspace(validatedPayload.id, validatedPayload.workspace);
};

exports.createVisitor = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.createVisitor);

  await Promise.all([
    workspaceValidation.throwErrorIfWorkspaceDoesNotExist(validatedPayload.workspace),
    websiteValidation.throwErrorIfWebsiteDoesNotExistInContextOfWorkspace(validatedPayload.website, validatedPayload.workspace),
  ]);

  if (validatedPayload.widget) {
    await widgetValidation.throwErrorIfWidgetDoesNotExistInContextOfWorkspaceAndWebsite(validatedPayload.widget, validatedPayload.workspace, validatedPayload.website);
  }

  if (!validatedPayload.anonymousId) {
    validatedPayload.anonymousId = generators.generateRandomToken({ prefix: "anon", bytes: 16 });

    await visitorValidation.throwErrorIfVisitorAnonymousIdExistsInContextOfWorkspace(validatedPayload.workspace, validatedPayload.anonymousId);
  }

  return visitorRepository.upsertVisitor(validatedPayload.workspace, validatedPayload.anonymousId, validatedPayload);
};

exports.updateVisitor = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.updateVisitor);

  const existingVisitor = await visitorValidation.throwErrorIfVisitorDoesNotExistInContextOfWorkspace(validatedPayload.id, validatedPayload.workspace);
  const updatePayload = {};

  if (validatedPayload.widget && validatedPayload.widget !== String(existingVisitor?.widget?._id)) {
    await widgetValidation.throwErrorIfWidgetDoesNotExistInContextOfWorkspaceAndWebsite(
      validatedPayload.widget,
      String(existingVisitor?.workspace?._id),
      String(existingVisitor?.website?._id),
    );
    updatePayload.widget = validatedPayload.widget;
  }

  if (validatedPayload.title && validatedPayload.title !== existingVisitor?.title) {
    updatePayload.title = validatedPayload.title;
  }

  if (validatedPayload.email && validatedPayload.email !== existingVisitor?.email) {
    updatePayload.email = validatedPayload.email;
  }

  if (validatedPayload.phone && validatedPayload.phone !== existingVisitor?.phone) {
    updatePayload.phone = validatedPayload.phone;
  }

  if (validatedPayload.isIdentified !== undefined && validatedPayload.isIdentified !== existingVisitor?.isIdentified) {
    updatePayload.isIdentified = validatedPayload.isIdentified;
  }

  if (validatedPayload.currentPage && validatedPayload.currentPage !== existingVisitor?.currentPage) {
    updatePayload.currentPage = validatedPayload.currentPage;
  }

  if (validatedPayload.referrer && validatedPayload.referrer !== existingVisitor?.referrer) {
    updatePayload.referrer = validatedPayload.referrer;
  }

  if (validatedPayload.browser && validatedPayload.browser !== existingVisitor?.browser) {
    updatePayload.browser = validatedPayload.browser;
  }

  if (validatedPayload.operatingSystem && validatedPayload.operatingSystem !== existingVisitor?.operatingSystem) {
    updatePayload.operatingSystem = validatedPayload.operatingSystem;
  }

  if (validatedPayload.device && validatedPayload.device !== existingVisitor?.device) {
    updatePayload.device = validatedPayload.device;
  }

  if (validatedPayload.country && validatedPayload.country !== existingVisitor?.country) {
    updatePayload.country = validatedPayload.country;
  }

  if (validatedPayload.language && validatedPayload.language !== existingVisitor?.language) {
    updatePayload.language = validatedPayload.language;
  }

  if (validatedPayload.firstSeenAt && validatedPayload.firstSeenAt !== existingVisitor?.firstSeenAt) {
    updatePayload.firstSeenAt = validatedPayload.firstSeenAt;
  }

  if (validatedPayload.lastSeenAt && validatedPayload.lastSeenAt !== existingVisitor?.lastSeenAt) {
    updatePayload.lastSeenAt = validatedPayload.lastSeenAt;
  }

  if (validatedPayload.lastActiveAt && validatedPayload.lastActiveAt !== existingVisitor?.lastActiveAt) {
    updatePayload.lastActiveAt = validatedPayload.lastActiveAt;
  }

  if (validatedPayload.isOnline !== undefined && validatedPayload.isOnline !== existingVisitor?.isOnline) {
    updatePayload.isOnline = validatedPayload.isOnline;
  }

  if (validatedPayload.sessionCount && validatedPayload.sessionCount !== existingVisitor?.sessionCount) {
    updatePayload.sessionCount = validatedPayload.sessionCount;
  }

  if (validatedPayload.metadata && !lodash.isEqual(validatedPayload.metadata, existingVisitor?.metadata)) {
    updatePayload.metadata = validatedPayload.metadata;
  }

  if (!Object.keys(updatePayload).length) return existingVisitor;

  return visitorRepository.updateVisitorById(validatedPayload.id, updatePayload);
};

exports.deleteVisitor = async (payload) => {
  const validatedPayload = joi.validate(payload, joiSchema.getVisitorById);

  await visitorValidation.throwErrorIfVisitorDoesNotExistInContextOfWorkspace(validatedPayload.id, validatedPayload.workspace);

  await visitorRepository.deleteVisitorById(validatedPayload.id);

  return { deletedId: validatedPayload.id };
};
