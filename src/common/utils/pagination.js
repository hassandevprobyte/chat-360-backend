'use strict';

const { BadRequestError } = require('../errors');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

/** Offset pagination - dashboard lists (members, websites, widgets, tags, ...). */
function parsePage(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT));
  return { page, limit, skip: (page - 1) * limit };
}

function pageMeta({ total, page, limit }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    pagination: {
      type: 'offset',
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Cursor pagination - high volume collections (messages, conversations,
 * notifications). Cursor encodes the sort key + _id tiebreaker.
 */
function encodeCursor({ sortValue, id }) {
  const value = sortValue instanceof Date ? sortValue.toISOString() : String(sortValue);
  return Buffer.from(JSON.stringify({ v: value, i: String(id) })).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
    if (!parsed.v || !parsed.i) throw new Error('malformed');
    return { value: parsed.v, id: parsed.i };
  } catch (err) {
    throw new BadRequestError('Invalid pagination cursor');
  }
}

function parseCursorQuery(query = {}) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(query.limit, 10) || DEFAULT_LIMIT));
  return {
    limit,
    cursor: decodeCursor(query.cursor),
    direction: query.direction === 'forward' ? 'forward' : 'backward',
  };
}

/**
 * Builds the mongo filter fragment for a cursor.
 * direction 'backward' walks into the past (default for chat history).
 */
function cursorFilter(cursor, { field = 'createdAt', direction = 'backward' } = {}) {
  if (!cursor) return {};
  const op = direction === 'backward' ? '$lt' : '$gt';
  const value = field === '_id' ? cursor.id : new Date(cursor.value);
  return {
    $or: [
      { [field]: { [op]: value } },
      { [field]: value, _id: { [op]: cursor.id } },
    ],
  };
}

function cursorMeta({ items, limit, field = 'createdAt', direction = 'backward' }) {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const last = page[page.length - 1];
  return {
    items: page,
    meta: {
      pagination: {
        type: 'cursor',
        limit,
        direction,
        hasMore,
        nextCursor: hasMore && last ? encodeCursor({ sortValue: last[field], id: last._id }) : null,
      },
    },
  };
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parsePage,
  pageMeta,
  parseCursorQuery,
  encodeCursor,
  decodeCursor,
  cursorFilter,
  cursorMeta,
};
