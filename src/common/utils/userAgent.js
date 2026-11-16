'use strict';

const { cleanText } = require('./sanitize');

/**
 * Tiny, dependency-free UA classifier. We only store coarse buckets - enough to
 * show "Chrome on macOS" in the dashboard, without fingerprinting the visitor.
 */
function parseUserAgent(userAgent = '') {
  const ua = String(userAgent || '');

  const browser = (() => {
    if (/Edg\//i.test(ua)) return 'Edge';
    if (/OPR\/|Opera/i.test(ua)) return 'Opera';
    if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
    if (/Chromium/i.test(ua)) return 'Chromium';
    if (/Firefox\//i.test(ua)) return 'Firefox';
    if (/Safari\//i.test(ua)) return 'Safari';
    if (/MSIE|Trident/i.test(ua)) return 'Internet Explorer';
    return 'Unknown';
  })();

  const operatingSystem = (() => {
    if (/Windows NT/i.test(ua)) return 'Windows';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Mac OS X/i.test(ua)) return 'macOS';
    if (/CrOS/i.test(ua)) return 'ChromeOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  })();

  const device = (() => {
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobile|iPhone|Android.*Mobile/i.test(ua)) return 'mobile';
    if (/Bot|Crawler|Spider/i.test(ua)) return 'bot';
    return 'desktop';
  })();

  return { browser, operatingSystem, device, userAgent: cleanText(ua, { maxLength: 400 }) };
}

/**
 * Country is read from a trusted edge/CDN header when present. We never attempt
 * IP geolocation ourselves and we do not persist the raw IP.
 */
function readCountry(req) {
  const header = req.get('cf-ipcountry') || req.get('x-vercel-ip-country') || req.get('x-geo-country');
  const code = cleanText(header, { maxLength: 2 });
  return code && /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : undefined;
}

module.exports = { parseUserAgent, readCountry };
