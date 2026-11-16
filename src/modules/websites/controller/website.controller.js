'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok, created } = require('../../../common/response');
const websiteService = require('../service/website.service');
const verificationService = require('../service/verification.service');

const create = asyncHandler(async (req, res) =>
  created(res, await websiteService.createWebsite(req.workspace, req.user, req.body)));

const list = asyncHandler(async (req, res) => {
  const { data, meta } = await websiteService.listWebsites(req.workspaceId, req.query);
  return ok(res, data, meta);
});

const get = asyncHandler(async (req, res) =>
  ok(res, await websiteService.getWebsite(req.workspaceId, req.params.websiteId)));

const update = asyncHandler(async (req, res) =>
  ok(res, await websiteService.updateWebsite(req.workspace, req.user, req.params.websiteId, req.body)));

const remove = asyncHandler(async (req, res) =>
  ok(res, await websiteService.deleteWebsite(req.workspace, req.user, req.params.websiteId)));

const getVerification = asyncHandler(async (req, res) =>
  ok(res, await verificationService.getInstructions(req.workspaceId, req.params.websiteId)));

const rotateVerificationToken = asyncHandler(async (req, res) =>
  ok(res, await verificationService.rotateToken(req.workspace, req.user, req.params.websiteId)));

const verify = asyncHandler(async (req, res) =>
  ok(res, await verificationService.verifyWebsite(req.workspace, req.user, req.params.websiteId, req.body.method)));

module.exports = { create, list, get, update, remove, getVerification, rotateVerificationToken, verify };
