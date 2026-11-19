const Picklist = require("./picklist.model");

// Constants
const { DEFAULTS } = require("../../common/constants");

const POPULATION_PIPELINE = [{ path: "workspace" }, { path: "parentPicklist" }];

exports.getAllPicklists = async (filters) => {
  return Picklist.find(filters).sort({ order: 1, title: 1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getPicklistsWithPagination = async (filters, offset, pageSize, sort) => {
  return Picklist.find(filters).skip(offset).limit(pageSize).sort({ order: 1, title: 1 }).lean();
};

exports.getPicklistsCount = async (filters) => {
  return Picklist.countDocuments(filters);
};

exports.getPicklistById = async (picklistId) => {
  return Picklist.findById(picklistId).populate(POPULATION_PIPELINE).lean();
};

exports.getPicklistByIdAndWorkspaceId = async (picklistId, workspaceId) => {
  return Picklist.findOne({ _id: picklistId, workspace: workspaceId }).populate(POPULATION_PIPELINE).lean();
};

exports.getPicklistByParentPicklistId = async (parentPicklistId) => {
  return Picklist.findOne({ parentPicklist: parentPicklistId });
};

exports.getPicklistByIdAndParentPicklistId = async (picklistId, parentPicklistId) => {
  return Picklist.findOne({ _id: picklistId, parentPicklist: parentPicklistId });
};

exports.getPicklistByIdAndContext = async (picklistId, workspace, resource, field, parentPicklist = null) => {
  const filters = { _id: picklistId, workspace, resource, parentPicklist, ...(field && { field }) };

  return Picklist.findOne(filters);
};

exports.getPicklistByValueInContext = (value, workspace, resource, field, parentPicklist = null) => {
  return Picklist.findOne({ value, workspace, resource, field, parentPicklist });
};

exports.getPicklistByAcronymInContext = (acronym, workspace, resource, field, parentPicklist = null) => {
  return Picklist.findOne({ acronym, workspace, resource, field, parentPicklist });
};

exports.getDefaultPicklistInContext = (workspace, resource, field, parentPicklist = null) => {
  return Picklist.findOne({ workspace, resource, field, parentPicklist, isDefault: true });
};

exports.getPicklistsByIds = async (picklistIds) => {
  return Picklist.find({ _id: { $in: picklistIds } });
};

exports.createPicklist = async (payload) => {
  return Picklist.create(payload);
};

exports.createDefaultPicklists = async (workspace) => {
  const picklists = DEFAULTS.PICKLIST.map((picklist) => ({
    ...picklist,
    workspace,
  }));

  return Picklist.insertMany(picklists);
};

exports.updatePicklistById = async (picklistId, payload) => {
  return Picklist.findByIdAndUpdate(picklistId, payload, { returnDocument: "after" });
};

exports.clearDefaultsInContext = async (workspace, resource, field, parentPicklist = null) => {
  return Picklist.updateMany({ workspace, resource, field, parentPicklist, isDefault: true }, { $set: { isDefault: false } });
};

exports.deletePicklistById = async (picklistId) => {
  return Picklist.findByIdAndDelete(picklistId);
};
