'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok } = require('../../../common/response');
const userService = require('../service/user.service');

const me = asyncHandler(async (req, res) => ok(res, await userService.getCurrentUser(req.user._id)));

const updateMe = asyncHandler(async (req, res) =>
  ok(res, await userService.updateProfile(req.user._id, req.body)));

module.exports = { me, updateMe };
