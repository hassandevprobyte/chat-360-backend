'use strict';

/** Full self-profile (only ever returned to the user themselves / super admin). */
function serializeUser(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id),
    name: user.name,
    email: user.email,
    avatar: user.avatar || null,
    platformRole: user.platformRole,
    isActive: user.isActive !== false,
    emailVerified: Boolean(user.emailVerifiedAt),
    emailVerifiedAt: user.emailVerifiedAt || null,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** The shape embedded in conversations/messages. No email, no platform role. */
function serializeUserSummary(user) {
  if (!user) return null;
  return {
    id: String(user._id || user.id),
    name: user.name,
    avatar: user.avatar || null,
  };
}

module.exports = { serializeUser, serializeUserSummary };
