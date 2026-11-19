const Joi = require("joi");
const dayjs = require("../libs/dayjs");
const validators = require("../common/validators");

const ExtendedJoi = Joi.extend(
  (joi) => ({
    type: "objectId",
    messages: {
      "objectId.invalid": "{{#label}} must be a valid MongoDB ObjectId",
    },
    validate(value, helpers) {
      if (!validators.isValidObjectId(value)) {
        return { errors: helpers.error("objectId.invalid") };
      }
    },
  }),
  (joi) => ({
    type: "monthDate",
    base: joi.date(),
    validate: (value) => ({
      value: dayjs(value).utc().startOf("month").toDate(),
    }),
  }),
);

ExtendedJoi.password = () => ExtendedJoi.string().min(8).max(128);

ExtendedJoi.name = () => ExtendedJoi.string().trim().min(1).max(120);

ExtendedJoi.hexColor = () =>
  ExtendedJoi.string()
    .pattern(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .messages({
      "string.pattern.base": "'{#label}' must be a hex colour such as #2563eb",
    });

ExtendedJoi.domain = () =>
  ExtendedJoi.string()
    .lowercase()
    .trim()
    .max(253)
    .pattern(/^(?:\*\.)?(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/)
    .messages({
      "string.pattern.base": "'{#label}' must be a valid domain such as example.com or *.example.com",
    });

ExtendedJoi.pageQuery = ExtendedJoi.object({
  page: ExtendedJoi.number().integer().min(1).default(1),
  limit: ExtendedJoi.number().integer().min(1).max(100).default(25),
  sort: ExtendedJoi.string().valid("createdAt", "-createdAt", "name", "-name", "updatedAt", "-updatedAt"),
  search: ExtendedJoi.string().trim().max(120).allow(""),
});

ExtendedJoi.cursorQuery = ExtendedJoi.object({
  limit: ExtendedJoi.number().integer().min(1).max(100).default(25),
  cursor: ExtendedJoi.string().max(300),
  direction: ExtendedJoi.string().valid("backward", "forward").default("backward"),
});

ExtendedJoi.dateRangeQuery = ExtendedJoi.object({
  from: ExtendedJoi.date().iso(),
  to: ExtendedJoi.date().iso().min(ExtendedJoi.ref("from")),
});

ExtendedJoi.workspaceParams = ExtendedJoi.object({
  workspaceId: ExtendedJoi.objectId().required(),
});

ExtendedJoi.idParam = (key = "id") =>
  ExtendedJoi.object({
    [key]: ExtendedJoi.objectId().required(),
  });

ExtendedJoi.workspaceScopedParams = (key) =>
  ExtendedJoi.object({
    workspaceId: ExtendedJoi.objectId().required(),
    [key]: ExtendedJoi.objectId().required(),
  });

// Bounded free-form metadata
ExtendedJoi.metadata = ExtendedJoi.object()
  .max(30)
  .pattern(ExtendedJoi.string().max(40), ExtendedJoi.alternatives().try(ExtendedJoi.string().max(500), ExtendedJoi.number(), ExtendedJoi.boolean(), ExtendedJoi.valid(null)));

ExtendedJoi.validate = (payload, schema, options) => {
  const { value, error } = schema.validate(payload, options);

  if (error) throw error;

  return value;
};

module.exports = ExtendedJoi;
