const Boom = require("@hapi/boom");
const mongoose = require("mongoose");

// Repositories
const picklistRepository = require("./picklist.repository");

// Constants
const { MESSAGE: message } = require("../../common/constants");

exports.throwErrorIfPicklistDoesNotExist = async (picklistId) => {
  const picklist = await picklistRepository.getPicklistById(picklistId);

  if (!picklist) {
    throw Boom.notFound(message.error.picklist.notFound);
  }

  return picklist;
};

exports.throwErrorIfPicklistWorkspaceDoesNotExist = async (picklistId, workspaceId) => {
  const picklist = await picklistRepository.getPicklistByIdAndWorkspaceId(picklistId, workspaceId);

  if (!picklist) {
    throw Boom.notFound(message.error.picklist.notFound);
  }

  return picklist;
};

exports.throwErrorIfPicklistDoesNotExistInParentPicklist = async (picklistId, parentPicklistId) => {
  const picklist = await picklistRepository.getPicklistByIdAndParentPicklistId(picklistId, parentPicklistId);

  if (!picklist) {
    throw Boom.notFound(message.error.picklist.notFound);
  }

  return picklist;
};

exports.throwErrorIfPicklistDoesNotExistInContext = async (picklistId, workspace, resource, field, parentPicklist) => {
  const picklist = await picklistRepository.getPicklistByIdAndContext(picklistId, workspace, resource, field, parentPicklist);
  console.log("1 Context => ", picklist);

  if (!picklist) {
    throw Boom.notFound(message.error.picklist.invalidContext);
  }

  return picklist;
};

exports.throwErrorIfAnyPicklistDoesNotExist = async (picklistIds = []) => {
  if (!Array.isArray(picklistIds) || picklistIds.length === 0) return [];

  const picklists = await picklistRepository.getPicklistsByIds(picklistIds);

  if (picklists.length !== picklistIds.length) {
    throw Boom.notFound(message.error.picklist.notFound);
  }

  return picklists;
};

exports.throwErrorIfPicklistValueExistsInContext = async (value, workspace, resource, field, parentPicklist) => {
  const exists = await picklistRepository.getPicklistByValueInContext(value, workspace, resource, field, parentPicklist);

  if (exists) {
    throw Boom.conflict(message.error.picklist.titleExists);
  }
};

exports.throwErrorIfPicklistAcronymExistsInContext = async (acronym, workspace, resource, field, parentPicklist) => {
  const exists = await picklistRepository.getPicklistByAcronymInContext(acronym, workspace, resource, field, parentPicklist);

  if (exists) {
    throw Boom.conflict(message.error.picklist.acronymExists);
  }
};

exports.throwErrorIfDefaultPicklistDoesNotExistInContext = async (resource, field, parentPicklist, workspace) => {
  const picklist = await picklistRepository.getDefaultPicklistInContext(workspace, resource, field, parentPicklist);

  if (!picklist) {
    throw Boom.notFound(message.error.picklist.defaultNotExists);
  }

  return picklist;
};
exports.throwErrorIfResourceOrFieldIsInvalid = (resource, field) => {
  const Model = mongoose.models[resource];

  if (!Model) {
    throw Boom.conflict(message.error.picklist.invalidResource(resource));
  }

  if (!Model.schema.path(field)) {
    throw Boom.conflict(message.error.picklist.invalidField(field));
  }
};

exports.throwErrorIfPicklistIsAssignedOnResource = async (picklistId) => {
  const picklist = await picklistRepository.getPicklistById(picklistId);

  const Model = mongoose.models[picklist.resource];

  if (!Model) {
    throw Boom.conflict(message.error.picklist.invalidResource(resource));
  }

  const schemaPath = Model.schema.path(picklist.field);

  if (!schemaPath) return;

  const isAssigned = await Model.exists({ [picklist.field]: picklist._id });

  if (isAssigned) {
    throw Boom.conflict(message.error.picklist.assignedOnResource(picklist.resource));
  }
};

exports.throwErrorIfDefaultPicklistIsBeingDeleted = async (picklistId) => {
  const picklist = await picklistRepository.getPicklistById(picklistId);

  if (picklist.isDefault) {
    throw Boom.conflict(message.error.picklist.defaultCannotBeDeleted);
  }
};

exports.throwErrorIfParentPicklistIsBeingDeleted = async (picklistId) => {
  const isAssigned = await picklistRepository.getPicklistByParentPicklistId(picklistId);

  if (isAssigned) {
    throw Boom.conflict(message.error.picklist.assignedOnResource("picklist"));
  }
};
