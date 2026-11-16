'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok } = require('../../../common/response');
const visitorService = require('../service/visitor.service');

const list = asyncHandler(async (req, res) => {
  const { data, meta } = await visitorService.listVisitors(req.workspaceId, req.query);
  return ok(res, data, meta);
});

const get = asyncHandler(async (req, res) =>
  ok(res, await visitorService.getVisitor(req.workspaceId, req.params.visitorId)));

module.exports = { list, get };
