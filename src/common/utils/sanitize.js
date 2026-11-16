'use strict';

const path = require('path');

/** Collapses whitespace and strips control characters from free-text input. */
function cleanText(value, { maxLength } = {}) {
  if (value === undefined || value === null) return value;
  let out = String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (maxLength && out.length > maxLength) out = out.slice(0, maxLength);
  return out;
}

/** Produces a storage-safe file name; never reuses client input as a path. */
function safeFileName(originalName = 'file') {
  const ext = path.extname(originalName).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 12);
  const base = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';
  return { base, ext };
}

/** Normalises a hostname for comparison: lowercase, no scheme, no port, no trailing dot. */
function normalizeDomain(value = '') {
  let domain = String(value).trim().toLowerCase();
  domain = domain.replace(/^[a-z]+:\/\//, '');
  domain = domain.split('/')[0];
  domain = domain.split('?')[0];
  domain = domain.replace(/:\d+$/, '');
  domain = domain.replace(/\.$/, '');
  return domain;
}

function originToHost(origin = '') {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch (err) {
    return normalizeDomain(origin);
  }
}

/**
 * Domain matching for widget origins. Supports an exact host and a single
 * leading wildcard (`*.example.com`). Deliberately conservative.
 */
function domainMatches(candidateHost, allowed) {
  const host = normalizeDomain(candidateHost);
  const pattern = normalizeDomain(allowed);
  if (!host || !pattern) return false;
  if (pattern === host) return true;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1); // '.example.com'
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return false;
}

/** Truncates a URL to origin + path, dropping query strings that may hold PII. */
function safePageUrl(value = '', maxLength = 512) {
  const raw = cleanText(value, { maxLength });
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, maxLength);
  } catch (err) {
    return raw.split('?')[0];
  }
}

module.exports = { cleanText, safeFileName, normalizeDomain, originToHost, domainMatches, safePageUrl };
