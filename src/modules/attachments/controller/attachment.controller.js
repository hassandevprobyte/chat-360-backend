'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok, created } = require('../../../common/response');
const attachmentService = require('../service/attachment.service');
const { serializeAttachment } = require('../serializer');

const upload = asyncHandler(async (req, res) => {
  const attachment = await attachmentService.upload({
    workspace: req.workspace,
    file: req.file,
    uploadedBy: req.user._id,
  });
  return created(res, serializeAttachment(attachment));
});

const list = asyncHandler(async (req, res) => {
  const { data, meta } = await attachmentService.listAttachments(req.workspaceId, req.query);
  return ok(res, data, meta);
});

const get = asyncHandler(async (req, res) =>
  ok(res, serializeAttachment(await attachmentService.getForWorkspace(req.workspaceId, req.params.attachmentId))));

const download = asyncHandler(async (req, res) => {
  const attachment = await attachmentService.getForWorkspace(req.workspaceId, req.params.attachmentId);
  const result = await attachmentService.openDownload(attachment);
  if (result.redirectTo) return res.redirect(302, result.redirectTo);
  res.set(result.headers);
  return result.stream.pipe(res);
});

const remove = asyncHandler(async (req, res) =>
  ok(res, await attachmentService.deleteAttachment(req.workspaceId, req.params.attachmentId)));

module.exports = { upload, list, get, download, remove };
