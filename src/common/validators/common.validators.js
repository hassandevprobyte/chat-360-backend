'use strict';

const Joi = require('joi');

const objectId = Joi.string().hex().length(24).messages({
  'string.hex': "'{#label}' must be a valid id",
  'string.length': "'{#label}' must be a valid id",
});

const email = Joi.string().email({ minDomainSegments: 2, tlds: { allow: false } }).lowercase().max(254);

/** Deliberately permissive on characters, strict on length; entropy over rules. */
const password = Joi.string().min(10).max(128).messages({
  'string.min': 'Password must be at least 10 characters long',
});

const name = Joi.string().trim().min(1).max(120);

const hexColor = Joi.string().pattern(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).messages({
  'string.pattern.base': "'{#label}' must be a hex colour such as #2563eb",
});

const domain = Joi.string()
  .lowercase()
  .trim()
  .max(253)
  .pattern(/^(\*\.)?(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/)
  .messages({ 'string.pattern.base': "'{#label}' must be a valid domain such as example.com or *.example.com" });

const pageQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  sort: Joi.string().valid('createdAt', '-createdAt', 'name', '-name', 'updatedAt', '-updatedAt'),
  search: Joi.string().trim().max(120).allow(''),
});

const cursorQuery = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(25),
  cursor: Joi.string().max(300),
  direction: Joi.string().valid('backward', 'forward').default('backward'),
});

const dateRangeQuery = Joi.object({
  from: Joi.date().iso(),
  to: Joi.date().iso().min(Joi.ref('from')),
});

const workspaceParams = Joi.object({ workspaceId: objectId.required() });

const idParam = (key = 'id') => Joi.object({ [key]: objectId.required() });

const workspaceScopedParams = (key) =>
  Joi.object({ workspaceId: objectId.required(), [key]: objectId.required() });

/** Bounded free-form metadata: prevents unbounded documents from client input. */
const metadata = Joi.object().max(30).pattern(
  Joi.string().max(40),
  Joi.alternatives().try(Joi.string().max(500), Joi.number(), Joi.boolean(), Joi.valid(null)),
);

module.exports = {
  objectId,
  email,
  password,
  name,
  hexColor,
  domain,
  pageQuery,
  cursorQuery,
  dateRangeQuery,
  workspaceParams,
  idParam,
  workspaceScopedParams,
  metadata,
};
