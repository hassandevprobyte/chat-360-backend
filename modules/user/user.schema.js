const Joi = require("../../config/joi");

// Constants
const { STATUSES, PLATFORM_ROLES, WORKSPACE_ROLES } = require("../../common/constants");

exports.getUserById = Joi.string().required();

exports.baseSchema = Joi.object({
  name: Joi.string().lowercase().trim().min(2).max(255),
  email: Joi.string().email().lowercase().trim().min(2).max(255),
  password: Joi.string().empty(""),
  platformRole: Joi.string().valid(...Object.values(PLATFORM_ROLES)),
  workspaceRole: Joi.string()
    .valid(...Object.values(WORKSPACE_ROLES))
    .when("platformRole", {
      is: PLATFORM_ROLES.USER,
      then: Joi.required(),
    }),
  permissions: Joi.array().items(Joi.string()).min(1).when("workspaceRole", {
    is: Joi.exist(),
    then: Joi.required(),
  }),
  status: Joi.string().valid(...Object.values(STATUSES.USER)),
  isActive: Joi.boolean(),
});

exports.createUser = exports.baseSchema
  .fork(["name", "email"], (schema) => schema.required())
  .fork("password", (schema) => schema.default("Abcd1234"))
  .fork("status", (schema) => schema.default(STATUSES.USER.ACTIVE))
  .fork("isActive", (schema) => schema.default(true));

exports.updateUser = exports.baseSchema.append({ id: Joi.objectId().required() });
