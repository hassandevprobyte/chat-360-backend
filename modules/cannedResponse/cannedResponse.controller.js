const asyncHandler = require("express-async-handler");

// Services
const cannedResponseService = require("./cannedResponse.service");

// @desc    Get all canned responses
// @route   GET /api/v1/workspaces/:slug/cannedResponses
// @access  Private
exports.getAllCannedResponses = asyncHandler(async (req, res) => {
  const filters = {
    ...req.filters,
    workspace: req.context?.workspace?._id,
  };

  const data = await cannedResponseService.getAllCannedResponses(filters);

  res.status(200).json(data);
});

// @desc    Get all canned responses
// @route   GET /api/v1/workspaces/:slug/cannedResponses
// @access  Private
exports.getCannedResponsesWithPagination = asyncHandler(async (req, res) => {
  const payload = {
    filters: { ...req.filters, workspace: req.context?.workspace?._id },
    page: req.pagination.page,
    pageSize: req.pagination.pageSize,
    sort: req.pagination.sort,
  };

  const data = await cannedResponseService.getCannedResponsesWithPagination(payload);

  res.status(200).json(data);
});

// @desc    Get canned response by id
// @route   GET /api/v1/workspaces/:slug/cannedResponses/:cannedResponseId
// @access  Private
exports.getCannedResponseById = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    id: req.params.id,
  };

  const data = await cannedResponseService.getCannedResponseById(payload);

  res.status(200).json(data);
});

// @desc    Create a new canned response
// @route   POST /api/v1/workspaces/:slug/cannedResponses
// @access  Private
exports.createCannedResponse = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    user: req.context?.user?._id,
    shortcut: req.body.shortcut,
    content: req.body.content,
    isActive: req.body.isActive,
    usageCount: req.body.usageCount,
    lastUsedAt: req.body.lastUsedAt,
  };

  const data = await cannedResponseService.createCannedResponse(payload);

  res.status(201).json(data);
});

// @desc    Update canned response
// @route   PATCH /api/v1/workspaces/:slug/cannedResponses/:cannedResponseId
// @access  Private
exports.updateCannedResponse = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    user: req.context?.user?._id,
    id: req.params.id,
    shortcut: req.body.shortcut,
    content: req.body.content,
    isActive: req.body.isActive,
    usageCount: req.body.usageCount,
    lastUsedAt: req.body.lastUsedAt,
  };

  const data = await cannedResponseService.updateCannedResponse(payload);

  res.status(200).json(data);
});

// @desc    Delete canned response
// @route   DELETE /api/v1/workspaces/:slug/cannedResponses/:cannedResponseId
// @access  Private
exports.deleteCannedResponse = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    id: req.params.id,
  };

  const data = await cannedResponseService.deleteCannedResponse(payload);

  res.status(200).json(data);
});
