'use strict';

const { ForbiddenError } = require('../errors');
const { PLATFORM_ROLES } = require('../constants');

/**
 * Platform-level gate. A workspace OWNER is never a Super Admin - their
 * authority stops at their own tenant boundary.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user) return next(new ForbiddenError('Authentication required'));
  if (req.user.platformRole !== PLATFORM_ROLES.SUPER_ADMIN) {
    return next(new ForbiddenError('Super admin privileges required'));
  }
  return next();
}

module.exports = requireSuperAdmin;
