const Visitor = require("./visitor.model");

const POPULATION_PIPELINE = [{ path: "workspace" }, { path: "website" }, { path: "widget" }];

exports.getAllVisitors = async (filters) => {
  return Visitor.find(filters).sort({ createdAt: -1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getVisitorsWithPagination = async (filters, offset, pageSize, sort) => {
  return Visitor.find(filters).skip(offset).limit(pageSize).sort(sort).populate(POPULATION_PIPELINE).lean();
};

exports.getVisitorsCount = async (filters) => {
  return Visitor.countDocuments(filters);
};

exports.getVisitorById = async (visitorId) => {
  return Visitor.findById(visitorId).populate(POPULATION_PIPELINE).lean();
};

exports.createVisitor = async (payload) => {
  return Visitor.create(payload);
};

exports.updateVisitorById = async (visitorId, payload) => {
  return Visitor.findByIdAndUpdate(visitorId, payload, { returnDocument: "after" });
};

exports.deleteVisitorById = async (visitorId) => {
  return Visitor.findByIdAndDelete(visitorId);
};
