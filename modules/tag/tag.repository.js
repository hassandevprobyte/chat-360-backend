const Tag = require("./tag.model");

const POPULATION_PIPELINE = [{ path: "workspace" }];

exports.getAllTags = async (filters) => {
  return Tag.find(filters).sort({ createdAt: -1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getTagsWithPagination = async (filters, offset, pageSize, sort) => {
  return Tag.find(filters).skip(offset).limit(pageSize).sort(sort).populate(POPULATION_PIPELINE).lean();
};

exports.getTagsCount = async (filters) => {
  return Tag.countDocuments(filters);
};

exports.getTagById = async (tagId) => {
  return Tag.findById(tagId).populate(POPULATION_PIPELINE).lean();
};

exports.getTagByWorkspaceId = async (workspaceId) => {
  return Tag.findOne({ workspace: workspaceId }).populate(POPULATION_PIPELINE).lean();
};

exports.getTagByTitleKeyAndWorkspaceId = async (titleKey, workspaceId) => {
  return Tag.findOne({ titleKey, workspace: workspaceId }).populate(POPULATION_PIPELINE).lean();
};

exports.createTag = async (payload) => {
  return Tag.create(payload);
};

exports.updateTagById = async (tagId, payload) => {
  return Tag.findByIdAndUpdate(tagId, payload, { returnDocument: "after" });
};

exports.deleteTagById = async (tagId) => {
  return Tag.findByIdAndDelete(tagId);
};
