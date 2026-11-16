'use strict';

const crypto = require('crypto');

function slugify(input = '') {
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'workspace';
}

/**
 * Generates a unique slug by probing the collection. Bounded attempts, then a
 * random suffix - the unique index remains the real guarantee.
 */
async function uniqueSlug(base, exists) {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let i = 2; i <= 6; i += 1) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${crypto.randomBytes(3).toString('hex')}`;
}

module.exports = { slugify, uniqueSlug };
