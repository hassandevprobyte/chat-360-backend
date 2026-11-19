const asyncHandler = require("express-async-handler");

// Services
const tagService = require("./tag.service");

// @desc    Get all tags
// @route   GET /api/v1/tags/all
// @access  Private
exports.getAllTags = asyncHandler(async (req, res) => {
  const data = await tagService.getAllTags(req.filters);

  res.status(200).json(data);
});

// @desc    Get tags with pagination
// @route   GET /api/v1/tags
// @access  Private
exports.getTagsWithPagination = asyncHandler(async (req, res) => {
  const payload = {
    filters: req.filters,
    page: req.pagination.page,
    pageSize: req.pagination.pageSize,
    sort: req.pagination.sort,
  };

  const data = await tagService.getTagsWithPagination(payload);

  res.status(200).json(data);
});

// @desc    Get Tag by id
// @route   GET /api/v1/tags/:id
// @access  Private
exports.getTagById = asyncHandler(async (req, res) => {
  const data = await tagService.getTagById(req.params.id);

  res.status(200).json(data);
});

// @desc    Create a new Tag
// @route   POST /api/v1/tags
// @access  Private
exports.createTag = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspaceId,
    title: req.body.title,
    titleKey: req.body.titleKey,
    color: req.body.color,
    description: req.body.description,
    isActive: req.body.isActive,
    createdBy: req.context?.user._id,
    metadata: req.body.metadata,
  };

  const data = await tagService.createTag(payload);

  res.status(201).json(data);
});

// @desc    Update Tag
// @route   PATCH /api/v1/tags/:id
// @access  Private
exports.updateTag = asyncHandler(async (req, res) => {
  const payload = {
    id: req.params.id,
    workspace: req.context?.workspaceId,
    title: req.body.title,
    titleKey: req.body.titleKey,
    color: req.body.color,
    description: req.body.description,
    isActive: req.body.isActive,
    createdBy: req.context?.user._id,
    metadata: req.body.metadata,
  };

  const data = await tagService.updateTag(payload);

  res.status(200).json(data);
});

// @desc    Delete Tag
// @route   DELETE /api/v1/tags/:id
// @access  Private
exports.deleteTag = asyncHandler(async (req, res) => {
  const data = await tagService.deleteTag(req.params.id);

  res.status(200).json(data);
});
