const Widget = require("./widget.model");

const POPULATION_PIPELINE = [{ path: "workspace" }, { path: "website" }];

exports.getAllWidgets = async (filters) => {
  return Widget.find(filters).sort({ createdAt: -1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getWidgetsWithPagination = async (filters, offset, pageSize, sort) => {
  return Widget.find(filters).skip(offset).limit(pageSize).sort(sort).populate(POPULATION_PIPELINE).lean();
};

exports.getWidgetsCount = async (filters) => {
  return Widget.countDocuments(filters);
};

exports.getWidgetById = async (widgetId) => {
  return Widget.findById(widgetId).populate(POPULATION_PIPELINE).lean();
};

exports.getWidgetByDomainAndWorkspaceId = async (domain, workspaceId) => {
  return Widget.findOne({ domain, workspace: workspaceId }).populate(POPULATION_PIPELINE).lean();
};

exports.deactivateAllWidgets = async (workspaceId, websiteId) => {
  return Widget.findOne({ workspace: workspaceId, website: websiteId }).populate(POPULATION_PIPELINE).lean();
};

exports.createWidget = async (payload) => {
  return Widget.create(payload);
};

exports.updateWidgetById = async (widgetId, payload) => {
  return Widget.findByIdAndUpdate(widgetId, payload, { returnDocument: "after" });
};

exports.deleteWidgetById = async (widgetId) => {
  return Widget.findByIdAndDelete(widgetId);
};
