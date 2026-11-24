const Tag = require("./tag.model");

const POPULATION_PIPELINE = [{ path: "workspace" }, { path: "createdBy" }];

exports.getAllTags = async (filters) => {
  return Tag.find(filters).sort({ createdAt: -1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getTagsWithPagination = async (filters, offset, pageSize, sort) => {
  return Tag.find(filters).skip(offset).limit(pageSize).sort(sort).populate(POPULATION_PIPELINE).lean();
};

exports.getTagsCount = async (filters) => {
  return Tag.countDocuments(filters);
};

exports.getTagById = async (workspaceId, tagId) => {
  return Tag.findOne({ workspace: workspaceId, _id: tagId }).populate(POPULATION_PIPELINE).lean();
};

exports.getTagByWorkspaceId = async (workspaceId) => {
  return Tag.findOne({ workspace: workspaceId }).populate(POPULATION_PIPELINE).lean();
};

exports.getTagByTitle = async (workspaceId, title) => {
  return Tag.findOne({ workspace: workspaceId, title }).populate(POPULATION_PIPELINE).lean();
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
