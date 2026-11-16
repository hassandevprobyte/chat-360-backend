'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok } = require('../../../common/response');
const auditLogService = require('../service/auditLog.service');

const list = asyncHandler(async (req, res) => {
  const { data, meta } = await auditLogService.listWorkspaceLogs(req.workspaceId, req.query);
  return ok(res, data, meta);
});

module.exports = { list };
