'use strict';

const path = require('path');
const multer = require('multer');
const env = require('../../config/env');
const { ALLOWED_ATTACHMENT_MIME_TYPES } = require('../constants');
const { UnsupportedMediaTypeError, BadRequestError } = require('../errors');

/**
 * Files are buffered in memory and handed to the storage provider by the
 * attachment service. Multer never writes to disk, so no temp path can leak and
 * the client's filename is never used as a path.
 */
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const mimeType = String(file.mimetype || '').toLowerCase();
  const allowedExtensions = ALLOWED_ATTACHMENT_MIME_TYPES[mimeType];

  if (!allowedExtensions) {
    return cb(new UnsupportedMediaTypeError(`File type '${mimeType}' is not allowed`));
  }

  // Both the declared MIME type and the extension must be on the allow list,
  // and they must agree with each other.
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ext || !allowedExtensions.includes(ext)) {
    return cb(
      new UnsupportedMediaTypeError(
        `File extension '${ext || 'none'}' does not match the declared type '${mimeType}'`,
      ),
    );
  }

  if ((file.originalname || '').length > 255) {
    return cb(new BadRequestError('File name is too long'));
  }

  return cb(null, true);
}

const singleFileUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.storage.maxFileSize, files: 1, fields: 10, parts: 15 },
}).single('file');

/** Wraps multer so its errors go through our central error handler. */
const uploadSingle = (req, res, next) =>
  singleFileUpload(req, res, (err) => {
    if (err) return next(err);
    if (!req.file) return next(new BadRequestError("A file is required in the 'file' field"));
    return next();
  });

module.exports = { uploadSingle };
