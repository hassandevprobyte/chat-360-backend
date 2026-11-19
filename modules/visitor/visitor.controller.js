const asyncHandler = require("express-async-handler");

// Services
const visitorService = require("./visitor.service");

// @desc    Get all visitors
// @route   GET /api/v1/visitors/all
// @access  Private
exports.getAllVisitors = asyncHandler(async (req, res) => {
  const data = await visitorService.getAllVisitors(req.filters);

  res.status(200).json(data);
});

// @desc    Get visitors with pagination
// @route   GET /api/v1/visitors
// @access  Private
exports.getVisitorsWithPagination = asyncHandler(async (req, res) => {
  const payload = {
    filters: req.filters,
    page: req.pagination.page,
    pageSize: req.pagination.pageSize,
    sort: req.pagination.sort,
  };

  const data = await visitorService.getVisitorsWithPagination(payload);

  res.status(200).json(data);
});

// @desc    Get Visitor by id
// @route   GET /api/v1/visitors/:id
// @access  Private
exports.getVisitorById = asyncHandler(async (req, res) => {
  const data = await visitorService.getVisitorById(req.params.id);

  res.status(200).json(data);
});

// @desc    Create a new Visitor
// @route   POST /api/v1/visitors
// @access  Private
exports.createVisitor = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspaceId,
    website: req.body.website,
    widget: req.body.widget,
    anonymousId: req.body.anonymousId,
    title: req.body.title,
    email: req.body.email,
    phone: req.body.phone,
    isIdentified: req.body.isIdentified,
    currentPage: req.body.currentPage,
    referrer: req.body.referrer,
    browser: req.body.browser,
    operatingSystem: req.body.operatingSystem,
    device: req.body.device,
    country: req.body.country,
    language: req.body.language,
    firstSeenAt: req.body.firstSeenAt,
    lastSeenAt: req.body.lastSeenAt,
    lastActiveAt: req.body.lastActiveAt,
    isOnline: req.body.isOnline,
    sessionCount: req.body.sessionCount,
    metadata: req.body.metadata,
  };

  const data = await visitorService.createVisitor(payload);

  res.status(201).json(data);
});

// @desc    Update Visitor
// @route   PATCH /api/v1/visitors/:id
// @access  Private
exports.updateVisitor = asyncHandler(async (req, res) => {
  const payload = {
    id: req.params.id,
    workspace: req.context?.workspaceId,
    website: req.body.website,
    widget: req.body.widget,
    anonymousId: req.body.anonymousId,
    title: req.body.title,
    email: req.body.email,
    phone: req.body.phone,
    isIdentified: req.body.isIdentified,
    currentPage: req.body.currentPage,
    referrer: req.body.referrer,
    browser: req.body.browser,
    operatingSystem: req.body.operatingSystem,
    device: req.body.device,
    country: req.body.country,
    language: req.body.language,
    firstSeenAt: req.body.firstSeenAt,
    lastSeenAt: req.body.lastSeenAt,
    lastActiveAt: req.body.lastActiveAt,
    isOnline: req.body.isOnline,
    sessionCount: req.body.sessionCount,
    metadata: req.body.metadata,
  };

  const data = await visitorService.updateVisitor(payload);

  res.status(200).json(data);
});

// @desc    Delete Visitor
// @route   DELETE /api/v1/visitors/:id
// @access  Private
exports.deleteVisitor = asyncHandler(async (req, res) => {
  const data = await visitorService.deleteVisitor(req.params.id);

  res.status(200).json(data);
});
