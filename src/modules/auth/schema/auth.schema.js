'use strict';

const Joi = require('joi');
const { email, password, name, objectId } = require('../../../common/validators/common.validators');

const register = {
  body: Joi.object({
    name: name.required(),
    email: email.required(),
    password: password.required(),
  }),
};

const login = {
  body: Joi.object({
    email: email.required(),
    // No strength rules on login: the stored password is whatever it is.
    password: Joi.string().max(128).required(),
  }),
};

const refresh = {
  body: Joi.object({ refreshToken: Joi.string().max(512) }),
};

const logout = {
  body: Joi.object({ refreshToken: Joi.string().max(512), allDevices: Joi.boolean().default(false) }),
};

const verifyEmail = {
  body: Joi.object({ token: Joi.string().max(512).required() }),
};

const forgotPassword = {
  body: Joi.object({ email: email.required() }),
};

const resetPassword = {
  body: Joi.object({
    token: Joi.string().max(512).required(),
    password: password.required(),
  }),
};

const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().max(128).required(),
    newPassword: password.required(),
  }),
};

const revokeSession = {
  params: Joi.object({ sessionId: objectId.required() }),
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  revokeSession,
};
