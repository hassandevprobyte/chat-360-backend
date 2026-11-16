'use strict';

const { ValidationError } = require('../errors');

const JOI_OPTIONS = {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
  errors: { wrap: { label: "'" } },
};

/**
 * Validates and *replaces* req.params / req.query / req.body with the coerced,
 * stripped value. Anything not described by the schema never reaches a service.
 */
function validate(schemas = {}) {
  const parts = ['params', 'query', 'body'].filter((part) => schemas[part]);

  return (req, res, next) => {
    const details = [];

    for (const part of parts) {
      const { value, error } = schemas[part].validate(req[part], JOI_OPTIONS);
      if (error) {
        error.details.forEach((d) => {
          details.push({ in: part, field: d.path.join('.'), message: d.message, type: d.type });
        });
      } else if (part === 'query') {
        // Express 5 exposes a getter-only req.query.
        Object.defineProperty(req, 'query', { value, writable: true, configurable: true });
      } else {
        req[part] = value;
      }
    }

    if (details.length) return next(new ValidationError('Request validation failed', details));
    return next();
  };
}

module.exports = validate;
