const Boom = require("@hapi/boom");
const asyncHandler = require("express-async-handler");

// Validations
const visitorValidation = require("../modules/visitor/visitor.validation");

// Helpers
const widgetHelpers = require("../modules/widget/widget.helper");
const visitorHelpers = require("../modules/visitor/visitor.helper");

const visitorAuth = asyncHandler(async (req, res, next) => {
  try {
    const accessToken = req.header("x-visitor-token");

    if (!accessToken) {
      throw Boom.forbidden(MESSAGE.error.auth.forbidden);
    }

    const payload = visitorHelpers.verifyVisitorToken(accessToken);

    const { workspace, website, widget } = await widgetHelpers.resolveByIds(payload);

    widgetHelpers.assertOriginAllowed(website, req);

    const visitor = await visitorValidation.throwErrorIfVisitorDoesNotExistInContextOfWorkspace(payload.sub, workspace._id);

    if (visitor.anonymousId !== payload.aid) {
      throw Boom.forbidden(MESSAGE.error.auth.forbidden);
    }

    req.context = {
      visitor,
      workspace,
      website,
      widget,
    };

    return next();
  } catch (error) {
    console.log(error);

    throw Boom.unauthorized(MESSAGE.error.auth.unauthorized);
  }
});

module.exports = visitorAuth;
