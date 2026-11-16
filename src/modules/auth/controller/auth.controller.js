'use strict';

const env = require('../../../config/env');
const asyncHandler = require('../../../common/utils/asyncHandler');
const { ok, created } = require('../../../common/response');
const authService = require('../service/auth.service');
const tokenService = require('../service/token.service');

/**
 * The refresh token is returned in the body (for non-browser clients) and,
 * when enabled, also set as an httpOnly cookie scoped to /api/v1/auth.
 */
function attachRefreshCookie(res, refreshToken) {
  if (!env.cookies.refreshEnabled) return;
  res.cookie(env.cookies.refreshName, refreshToken, tokenService.refreshCookieOptions());
}

function clearRefreshCookie(res) {
  if (!env.cookies.refreshEnabled) return;
  res.clearCookie(env.cookies.refreshName, { ...tokenService.refreshCookieOptions(), maxAge: undefined });
}

/** Cookie first, then body - a browser client never has to hold the token in JS. */
const readRefreshToken = (req) =>
  (req.cookies && req.cookies[env.cookies.refreshName]) || (req.body && req.body.refreshToken) || null;

const register = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body, req);
  attachRefreshCookie(res, result.refreshToken);
  return created(res, result);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body, req);
  attachRefreshCookie(res, result.refreshToken);
  return ok(res, result);
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(readRefreshToken(req), req);
  attachRefreshCookie(res, result.refreshToken);
  return ok(res, result);
});

const logout = asyncHandler(async (req, res) => {
  const result = await authService.logout(readRefreshToken(req), req.user ? req.user._id : null, {
    allDevices: Boolean(req.body && req.body.allDevices),
  });
  clearRefreshCookie(res);
  return ok(res, result);
});

const verifyEmail = asyncHandler(async (req, res) => ok(res, await authService.verifyEmail(req.body.token)));

const resendVerification = asyncHandler(async (req, res) =>
  ok(res, await authService.resendVerification(req.user._id)));

const forgotPassword = asyncHandler(async (req, res) =>
  ok(res, await authService.forgotPassword(req.body.email)));

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  clearRefreshCookie(res);
  return ok(res, result);
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user._id, req.body);
  clearRefreshCookie(res);
  return ok(res, result);
});

const listSessions = asyncHandler(async (req, res) => ok(res, await authService.listSessions(req.user._id)));

const revokeSession = asyncHandler(async (req, res) =>
  ok(res, await authService.revokeSession(req.user._id, req.params.sessionId)));

module.exports = {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  listSessions,
  revokeSession,
};
