const asyncHandler = require("express-async-handler");

// Services
const widgetService = require("./widget.service");

// @desc    Get all widgets
// @route   GET /api/v1/widgets/all
// @access  Private
exports.getAllWidgets = asyncHandler(async (req, res) => {
  const data = await widgetService.getAllWidgets(req.filters);

  res.status(200).json(data);
});

// @desc    Get widgets with pagination
// @route   GET /api/v1/widgets
// @access  Private
exports.getWidgetsWithPagination = asyncHandler(async (req, res) => {
  const payload = {
    filters: req.filters,
    page: req.pagination.page,
    pageSize: req.pagination.pageSize,
    sort: req.pagination.sort,
  };

  const data = await widgetService.getWidgetsWithPagination(payload);

  res.status(200).json(data);
});

// @desc    Get Widget by id
// @route   GET /api/v1/widgets/:id
// @access  Private
exports.getWidgetById = asyncHandler(async (req, res) => {
  const data = await widgetService.getWidgetById(req.params.id);

  res.status(200).json(data);
});

// @desc    Create a new Widget
// @route   POST /api/v1/widgets
// @access  Private
exports.createWidget = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspaceId,
    website: req.body.website,
    title: req.body.title,
    publicKey: req.body.publicKey,
    isActive: req.body.isActive,
    settings: req.body.settings,
    deletedAt: req.body.deletedAt,
  };

  const data = await widgetService.createWidget(payload);

  res.status(201).json(data);
});

// @desc    Update Widget
// @route   PATCH /api/v1/widgets/:id
// @access  Private
exports.updateWidget = asyncHandler(async (req, res) => {
  const payload = {
    id: req.params.id,
    title: req.body.title,
    isActive: req.body.isActive,
    settings: req.body.settings,
  };

  const data = await widgetService.updateWidget(payload);

  res.status(200).json(data);
});

// @desc    Delete Widget
// @route   DELETE /api/v1/widgets/:id
// @access  Private
exports.deleteWidget = asyncHandler(async (req, res) => {
  const data = await widgetService.deleteWidget(req.params.id);

  res.status(200).json(data);
});
