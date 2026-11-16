'use strict';

function serializeTag(tag) {
  if (!tag) return null;
  return {
    id: String(tag._id || tag.id),
    name: tag.name,
    color: tag.color,
    description: tag.description || null,
    isActive: tag.isActive !== false,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

module.exports = { serializeTag };
