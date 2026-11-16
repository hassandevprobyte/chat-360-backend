'use strict';

const mongoose = require('mongoose');
const multer = require('multer');
const env = require('../../config/env');
const logger = require('../logger');
const { failure } = require('../response');
const { AppError } = require('../errors');
const { ERROR_CODES } = require('../constants');

function notFoundHandler(req, res) {
  return failure(res, {
    status: 404,
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
}

/** Translates framework/driver errors into our envelope without leaking internals. */
function normalizeError(err) {
  if (err instanceof AppError) {
    return { status: err.statusCode, code: err.code, message: err.message, details: err.details };
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return {
      status: 422,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Request validation failed',
      details: Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })),
    };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { status: 404, code: ERROR_CODES.RESOURCE_NOT_FOUND, message: 'Resource not found' };
  }

  // Duplicate key: report the conflicting field, never the raw driver message.
  if (err && (err.code === 11000 || err.code === 11001)) {
    const fields = Object.keys(err.keyPattern || err.keyValue || {});
    return {
      status: 409,
      code: ERROR_CODES.ALREADY_EXISTS,
      message: 'A record with these values already exists',
      details: fields.length ? [{ fields }] : undefined,
    };
  }

  if (err instanceof multer.MulterError) {
    const tooLarge = err.code === 'LIMIT_FILE_SIZE';
    return {
      status: tooLarge ? 413 : 400,
      code: tooLarge ? ERROR_CODES.PAYLOAD_TOO_LARGE : ERROR_CODES.BAD_REQUEST,
      message: tooLarge ? 'File exceeds the maximum allowed size' : `Upload rejected: ${err.code}`,
    };
  }

  if (err && err.type === 'entity.too.large') {
    return { status: 413, code: ERROR_CODES.PAYLOAD_TOO_LARGE, message: 'Request body is too large' };
  }

  if (err && err.type === 'entity.parse.failed') {
    return { status: 400, code: ERROR_CODES.BAD_REQUEST, message: 'Request body is not valid JSON' };
  }

  return { status: 500, code: ERROR_CODES.INTERNAL_ERROR, message: 'Something went wrong' };
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const normalized = normalizeError(err);

  const logPayload = {
    err,
    status: normalized.status,
    code: normalized.code,
    method: req.method,
    url: req.originalUrl,
    userId: req.user ? req.user.id : undefined,
    workspaceId: req.workspaceId ? String(req.workspaceId) : undefined,
    requestId: req.id,
  };

  if (normalized.status >= 500) logger.error(logPayload, 'Unhandled request error');
  else if (normalized.status === 401 || normalized.status === 403) logger.warn(logPayload, 'Request denied');
  else logger.debug(logPayload, 'Request error');

  const body = {
    status: normalized.status,
    code: normalized.code,
    message: normalized.message,
    details: normalized.details,
  };

  // Stack traces are development-only and never part of the contract.
  if (!env.isProduction && normalized.status >= 500) {
    body.details = { stack: String(err.stack || '').split('\n').slice(0, 8) };
  }

  return failure(res, body);
}

module.exports = { errorHandler, notFoundHandler };
