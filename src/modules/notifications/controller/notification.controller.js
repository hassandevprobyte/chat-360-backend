'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok } = require('../../../common/response');
const notificationService = require('../service/notification.service');

const list = asyncHandler(async (req, res) => {
  const { data, meta } = await notificationService.list(req.user._id, req.query);
  return ok(res, data, meta);
});

const unreadCount = asyncHandler(async (req, res) =>
  ok(res, await notificationService.unreadCount(req.user._id, req.query.workspaceId)));

const markRead = asyncHandler(async (req, res) =>
  ok(res, await notificationService.markRead(req.user._id, req.params.id)));

const markAllRead = asyncHandler(async (req, res) =>
  ok(res, await notificationService.markAllRead(req.user._id, req.body.workspaceId)));

module.exports = { list, unreadCount, markRead, markAllRead };
