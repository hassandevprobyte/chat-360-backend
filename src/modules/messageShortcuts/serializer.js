'use strict';

/**
 * `trigger` is what the dashboard shows in the "/" dropdown; `shortcut` is the
 * stored key. Sending both keeps the frontend free of formatting rules.
 */
function serializeShortcut(shortcut) {
  if (!shortcut) return null;
  return {
    id: String(shortcut._id || shortcut.id),
    shortcut: shortcut.shortcut,
    trigger: `/${shortcut.shortcut}`,
    content: shortcut.content,
    isActive: shortcut.isActive !== false,
    usageCount: shortcut.usageCount || 0,
    lastUsedAt: shortcut.lastUsedAt || null,
    createdAt: shortcut.createdAt,
    updatedAt: shortcut.updatedAt,
  };
}

module.exports = { serializeShortcut };
