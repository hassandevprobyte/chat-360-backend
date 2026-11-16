'use strict';

const { ERROR_CODES } = require('../constants');

class AppError extends Error {
  constructor(message, { statusCode = 500, code = ERROR_CODES.INTERNAL_ERROR, details, expose = true } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = expose;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = ERROR_CODES.BAD_REQUEST, details) {
    super(message, { statusCode: 400, code, details });
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details) {
    super(message, { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR, details });
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = ERROR_CODES.UNAUTHORIZED, details) {
    super(message, { statusCode: 401, code, details });
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource', code = ERROR_CODES.FORBIDDEN, details) {
    super(message, { statusCode: 403, code, details });
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = ERROR_CODES.RESOURCE_NOT_FOUND, details) {
    super(message, { statusCode: 404, code, details });
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = ERROR_CODES.CONFLICT, details) {
    super(message, { statusCode: 409, code, details });
  }
}

class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload too large', details) {
    super(message, { statusCode: 413, code: ERROR_CODES.PAYLOAD_TOO_LARGE, details });
  }
}

class UnsupportedMediaTypeError extends AppError {
  constructor(message = 'Unsupported media type', details) {
    super(message, { statusCode: 415, code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, details });
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', details) {
    super(message, { statusCode: 429, code: ERROR_CODES.RATE_LIMITED, details });
  }
}

class InternalError extends AppError {
  constructor(message = 'Something went wrong') {
    super(message, { statusCode: 500, code: ERROR_CODES.INTERNAL_ERROR, expose: false });
  }
}

module.exports = {
  AppError,
  BadRequestError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  TooManyRequestsError,
  InternalError,
};
