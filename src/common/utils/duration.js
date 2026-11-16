'use strict';

const UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, y: 31557600000 };

/** Parses '15m' | '7d' | 3600 into milliseconds. */
function toMs(value) {
  if (typeof value === 'number') return value;
  const match = /^(-?\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)?$/i.exec(String(value).trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const unit = (match[2] || 'ms').toLowerCase();
  return Math.round(Number(match[1]) * UNITS[unit]);
}

const fromNow = (value) => new Date(Date.now() + toMs(value));
const toSeconds = (value) => Math.round(toMs(value) / 1000);

module.exports = { toMs, toSeconds, fromNow };
