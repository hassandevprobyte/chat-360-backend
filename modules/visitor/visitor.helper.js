const Boom = require("@hapi/boom");
const jwt = require("jsonwebtoken");

// Environment Variables
const env = require("../../config/env");

// Common
const { MESSAGE } = require("../../common/constants");

exports.signVisitorToken = ({ visitorId, workspaceId, websiteId, widgetId, anonymousId }) => {
  return jwt.sign(
    {
      sub: String(visitorId),
      typ: "visitor",
      ws: String(workspaceId),
      site: String(websiteId),
      wid: String(widgetId),
      aid: anonymousId,
    },
    env.JWT.WIDGET_TOKEN_SECRET,
    { expiresIn: env.JWT.WIDGET_TOKEN_EXPIRES_IN, issuer: env.APP_NAME },
  );
};

exports.verifyVisitorToken = (token) => {
  try {
    const payload = jwt.verify(token, env.JWT.WIDGET_TOKEN_SECRET, { issuer: env.APP_NAME });

    if (payload.typ !== "visitor") {
      throw Boom.forbidden(MESSAGE.error.auth.forbidden);
    }

    return payload;
  } catch (err) {
    throw Boom.unauthorized(MESSAGE.error.auth.unauthorized);
  }
};
