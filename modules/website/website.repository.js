const Website = require("./website.model");

const POPULATION_PIPELINE = [{ path: "workspace" }];

exports.getAllWebsites = async (filters) => {
  return Website.find(filters).sort({ createdAt: -1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getWebsitesWithPagination = async (filters, offset, pageSize, sort) => {
  return Website.find(filters).skip(offset).limit(pageSize).sort(sort).populate(POPULATION_PIPELINE).lean();
};

exports.getWebsitesCount = async (filters) => {
  return Website.countDocuments(filters);
};

exports.getWebsiteById = async (websiteId) => {
  return Website.findById(websiteId).populate(POPULATION_PIPELINE).lean();
};

exports.getWebsiteByIdAndWorkspaceId = async (websiteId, workspaceId) => {
  return Website.findOne({ _id: websiteId, workspace: workspaceId }).populate(POPULATION_PIPELINE).lean();
};

exports.getWebsiteByDomain = async (workspaceId, domain) => {
  return Website.findOne({ workspace: workspaceId, domain }).populate(POPULATION_PIPELINE).lean();
};

exports.getWebsiteByIdAndAllowedDomain = async (websiteId, domain) => {
  return Website.findOne({ _id: websiteId, allowedDomains: domain }).populate(POPULATION_PIPELINE).lean();
};

exports.createWebsite = async (payload) => {
  return Website.create(payload);
};

exports.updateWebsiteById = async (websiteId, payload) => {
  return Website.findByIdAndUpdate(websiteId, payload, { returnDocument: "after" });
};

exports.deleteWebsiteById = async (websiteId) => {
  return Website.findByIdAndDelete(websiteId);
};
