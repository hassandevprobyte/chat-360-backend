'use strict';

/** Single source of truth for the API envelope. */
function success(res, data = null, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

const ok = (res, data, meta) => success(res, data, { status: 200, meta });
const created = (res, data, meta) => success(res, data, { status: 201, meta });
const noContent = (res) => res.status(204).send();

function failure(res, { status = 500, code = 'INTERNAL_ERROR', message = 'Something went wrong', details }) {
  const error = { code, message };
  if (details) error.details = details;
  return res.status(status).json({ success: false, error });
}

module.exports = { success, ok, created, noContent, failure };
