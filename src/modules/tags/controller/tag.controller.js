'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok, created } = require('../../../common/response');
const tagService = require('../service/tag.service');

const create = asyncHandler(async (req, res) =>
  created(res, await tagService.createTag(req.workspace, req.user, req.body)));

const list = asyncHandler(async (req, res) => {
  const { data, meta } = await tagService.listTags(req.workspaceId, req.query);
  return ok(res, data, meta);
});

const get = asyncHandler(async (req, res) =>
  ok(res, await tagService.getTag(req.workspaceId, req.params.tagId)));

const update = asyncHandler(async (req, res) =>
  ok(res, await tagService.updateTag(req.workspace, req.user, req.params.tagId, req.body)));

const remove = asyncHandler(async (req, res) =>
  ok(res, await tagService.deleteTag(req.workspace, req.user, req.params.tagId)));

module.exports = { create, list, get, update, remove };
