'use strict';

const mongoose = require('mongoose');
const { NotFoundError } = require('../errors');

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value)) && /^[a-f\d]{24}$/i.test(String(value));

const toObjectId = (value) => new mongoose.Types.ObjectId(String(value));

/**
 * A malformed id is a 404 rather than a 500 - it also avoids leaking whether a
 * given id shape exists in another tenant.
 */
function requireObjectId(value, resourceName = 'Resource') {
  if (!isObjectId(value)) throw new NotFoundError(`${resourceName} not found`);
  return toObjectId(value);
}

const idEquals = (a, b) => String(a || '') === String(b || '') && Boolean(a) && Boolean(b);

module.exports = { isObjectId, toObjectId, requireObjectId, idEquals };
