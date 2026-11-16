'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok, created } = require('../../../common/response');
const shortcutService = require('../service/messageShortcut.service');

const ctx = (req) => ({ workspace: req.workspace, actor: req.user, member: req.member });

const create = asyncHandler(async (req, res) => created(res, await shortcutService.createShortcut(ctx(req), req.body)));

const list = asyncHandler(async (req, res) => {
  const { data, meta } = await shortcutService.listShortcuts(ctx(req), req.query);
  return ok(res, data, meta);
});

const get = asyncHandler(async (req, res) =>
  ok(res, await shortcutService.getShortcut(ctx(req), req.params.shortcutId)));

const update = asyncHandler(async (req, res) =>
  ok(res, await shortcutService.updateShortcut(ctx(req), req.params.shortcutId, req.body)));

const remove = asyncHandler(async (req, res) =>
  ok(res, await shortcutService.deleteShortcut(ctx(req), req.params.shortcutId)));

module.exports = { create, list, get, update, remove };
