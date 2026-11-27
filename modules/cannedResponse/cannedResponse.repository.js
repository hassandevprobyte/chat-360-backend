const CannedResponse = require("./cannedResponse.model");

const POPULATION_PIPELINE = [{ path: "workspace" }, { path: "user" }, { path: "tags" }];

exports.getAllCannedResponses = async (filters) => {
  return CannedResponse.find(filters).sort({ createdAt: -1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getCannedResponsesWithPagination = async (filters, offset, pageSize, sort) => {
  return CannedResponse.find(filters).skip(offset).limit(pageSize).sort(sort).populate(POPULATION_PIPELINE).lean();
};

exports.getCannedResponseCount = async (filters) => {
  return CannedResponse.countDocuments(filters);
};

exports.getCannedResponseById = async (cannedResponseId) => {
  return CannedResponse.findById(cannedResponseId).populate(POPULATION_PIPELINE).lean();
};

exports.getCannedResponseByIdAndWorkspaceId = async (cannedResponseId, workspaceId) => {
  return CannedResponse.findOne({ _id: cannedResponseId, workspace: workspaceId }).populate(POPULATION_PIPELINE).lean();
};

exports.getCannedResponseByWorkspaceId = async (workspaceId) => {
  return CannedResponse.findOne({ workspace: workspaceId }).populate(POPULATION_PIPELINE).lean();
};

exports.getCannedResponseByUserId = async (userId) => {
  return CannedResponse.findOne({ user: userId }).populate(POPULATION_PIPELINE).lean();
};

exports.getCannedResponseByWorkspaceIdAndUserId = async (workspaceId, userId) => {
  return CannedResponse.findOne({ workspace: workspaceId, user: userId }).populate(POPULATION_PIPELINE).lean();
};

exports.getCannedResponseByInContext = async (cannedResposenId, workspaceId, userId) => {
  return CannedResponse.findOne({ _id: cannedResposenId, workspace: workspaceId, user: userId }).populate(POPULATION_PIPELINE).lean();
};

exports.getCannedResponseByShortcutInContext = async (shortcut, workspaceId, userId) => {
  return CannedResponse.findOne({ shortcut, workspace: workspaceId, user: userId }).populate(POPULATION_PIPELINE).lean();
};

exports.createCannedResponse = async (payload) => {
  return CannedResponse.create(payload);
};

exports.updateCannedResponseById = async (cannedResponseId, payload) => {
  return CannedResponse.findByIdAndUpdate(cannedResponseId, payload, { returnDocument: "after" });
};

exports.deleteCannedResponseById = async (cannedResponseId) => {
  return CannedResponse.findByIdAndDelete(cannedResponseId);
};
