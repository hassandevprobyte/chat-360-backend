'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok, created } = require('../../../common/response');
const widgetService = require('../service/widget.service');

const create = asyncHandler(async (req, res) =>
  created(res, await widgetService.createWidget(req.workspace, req.user, req.body)));

const list = asyncHandler(async (req, res) => {
  const { data, meta } = await widgetService.listWidgets(req.workspaceId, req.query);
  return ok(res, data, meta);
});

const get = asyncHandler(async (req, res) =>
  ok(res, await widgetService.getWidget(req.workspaceId, req.params.widgetId)));

const update = asyncHandler(async (req, res) =>
  ok(res, await widgetService.updateWidget(req.workspace, req.user, req.params.widgetId, req.body)));

const rotateKey = asyncHandler(async (req, res) =>
  ok(res, await widgetService.rotatePublicKey(req.workspace, req.user, req.params.widgetId)));

const remove = asyncHandler(async (req, res) =>
  ok(res, await widgetService.deleteWidget(req.workspace, req.user, req.params.widgetId)));

module.exports = { create, list, get, update, rotateKey, remove };
