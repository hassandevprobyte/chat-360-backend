const asyncHandler = require("express-async-handler");

// Services
const websiteService = require("./website.service");

// @desc    Get all websites
// @route   GET /api/v1/websites/all
// @access  Private
exports.getAllWebsites = asyncHandler(async (req, res) => {
  const filters = { ...req.filters, workspace: req.context?.workspace?._id };

  const data = await websiteService.getAllWebsites(filters);

  res.status(200).json(data);
});

// @desc    Get websites with pagination
// @route   GET /api/v1/websites
// @access  Private
exports.getWebsitesWithPagination = asyncHandler(async (req, res) => {
  const payload = {
    filters: { ...req.filters, workspace: req.context?.workspace?._id },
    page: req.pagination.page,
    pageSize: req.pagination.pageSize,
    sort: req.pagination.sort,
  };

  const data = await websiteService.getWebsitesWithPagination(payload);

  res.status(200).json(data);
});

// @desc    Get Website by id
// @route   GET /api/v1/websites/:id
// @access  Private
exports.getWebsiteById = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    id: req.params.id,
  };

  const data = await websiteService.getWebsiteById(payload);

  res.status(200).json(data);
});

// @desc    Create a new Website
// @route   POST /api/v1/websites
// @access  Private
exports.createWebsite = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    title: req.body.title,
    domain: req.body.domain,
    allowedDomains: req.body.allowedDomains,
    status: req.body.status,
    verificationStatus: req.body.verificationStatus,
    verificationToken: req.body.verificationToken,
    verificationMethod: req.body.verificationMethod,
    verifiedAt: req.body.verifiedAt,
    lastVerificationAttemptAt: req.body.lastVerificationAttemptAt,
    lastVerificationError: req.body.lastVerificationError,
    settings: req.body.settings,
    metadata: req.body.metadata,
  };

  const data = await websiteService.createWebsite(payload);

  res.status(201).json(data);
});

// @desc    Update Website
// @route   PATCH /api/v1/websites/:id
// @access  Private
exports.updateWebsite = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    id: req.params.id,
    title: req.body.title,
    domain: req.body.domain,
    allowedDomains: req.body.allowedDomains,
    status: req.body.status,
    verificationStatus: req.body.verificationStatus,
    verificationToken: req.body.verificationToken,
    verificationMethod: req.body.verificationMethod,
    verifiedAt: req.body.verifiedAt,
    lastVerificationAttemptAt: req.body.lastVerificationAttemptAt,
    lastVerificationError: req.body.lastVerificationError,
    settings: req.body.settings,
    metadata: req.body.metadata,
  };

  const data = await websiteService.updateWebsite(payload);

  res.status(200).json(data);
});

// @desc    Delete Website
// @route   DELETE /api/v1/websites/:id
// @access  Private
exports.deleteWebsite = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    id: req.params.id,
  };

  const data = await websiteService.deleteWebsite(payload);

  res.status(200).json(data);
});
