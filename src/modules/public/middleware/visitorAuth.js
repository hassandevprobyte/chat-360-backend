'use strict';

const asyncHandler = require('../../../common/utils/asyncHandler');
const { UnauthorizedError } = require('../../../common/errors');
const { readBearer } = require('../../../common/middleware/authenticate');
const tokenService = require('../../auth/service/token.service');
const visitorRepository = require('../../visitors/repository/visitor.repository');
const widgetContext = require('../service/widgetContext.service');

/**
 * Authenticates a widget request with a visitor session token.
 *
 * Visitor tokens are signed with a different secret and carry `typ: 'visitor'`,
 * so a dashboard access token presented here fails verification and vice
 * versa. The tenant context is rebuilt from the token's claims and re-verified
 * against the database on every request - a suspended workspace or a rotated
 * widget key invalidates existing sessions immediately.
 */
const visitorAuth = asyncHandler(async (req, res, next) => {
  const token = readBearer(req) || req.get('x-visitor-token');
  if (!token) throw new UnauthorizedError('Visitor session required');

  const payload = tokenService.verifyVisitorToken(token);
  const { workspace, website, widget } = await widgetContext.resolveByIds(payload);

  widgetContext.assertOriginAllowed(website, req);

  const visitor = await visitorRepository.findOneInWorkspace(workspace._id, payload.sub);
  if (!visitor || visitor.anonymousId !== payload.aid) {
    throw new UnauthorizedError('Visitor session is no longer valid');
  }

  req.visitor = { ...visitor, id: String(visitor._id) };
  req.workspace = workspace;
  req.workspaceId = workspace._id;
  req.website = website;
  req.widget = widget;
  return next();
});

module.exports = visitorAuth;
