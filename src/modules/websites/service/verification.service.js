'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');
const crypto = require('node:crypto');

const { VERIFICATION_STATUS, VERIFICATION_METHODS, AUDIT_ACTIONS, ERROR_CODES } = require('../../../common/constants');
const { AppError, BadRequestError, NotFoundError } = require('../../../common/errors');
const { requireObjectId } = require('../../../common/utils/objectId');
const logger = require('../../../common/logger');
const websiteRepository = require('../repository/website.repository');
const auditLogService = require('../../auditLogs/service/auditLog.service');
const { serializeWebsite } = require('../serializer');

const DNS_TXT_KEY = 'livechat-site-verification';
const META_TAG_NAME = 'livechat-site-verification';
const FETCH_TIMEOUT_MS = 6000;
const MAX_RESPONSE_BYTES = 512 * 1024; // generous for a homepage <head> or a one-line file
const USER_AGENT = 'LiveChatVerificationBot/1.0';

/** URL-safe, human-typeable-enough token. Not a secret in the JWT sense - it's
 * published in DNS/HTML/a public file by design - so a plain hex string is fine. */
const generateToken = () => crypto.randomBytes(20).toString('hex');

const verificationFileName = (token) => `livechat-verification-${token}.txt`;

// ---------------------------------------------------------------------------
// SSRF guard: the domain is client-supplied, and the meta-tag / file checks
// make an outbound HTTP request to it. Refuse to fetch anything that resolves
// to a private/loopback/link-local address before ever calling fetch().
// ---------------------------------------------------------------------------

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const value = ip.toLowerCase();
    if (value === '::1') return true;
    if (value.startsWith('fe80:')) return true;
    if (value.startsWith('fc') || value.startsWith('fd')) return true; // unique local
    if (value.startsWith('::ffff:')) {
      const v4 = value.split(':').pop();
      return net.isIPv4(v4) ? isPrivateIp(v4) : true;
    }
    return false;
  }
  return true; // unrecognised shape - refuse rather than guess
}

async function assertPublicHostname(hostname) {
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (err) {
    throw new BadRequestError(`Could not resolve ${hostname}`, ERROR_CODES.VERIFICATION_FAILED);
  }
  if (!addresses.length || addresses.some((a) => isPrivateIp(a.address))) {
    throw new BadRequestError(`${hostname} does not resolve to a public address`, ERROR_CODES.VERIFICATION_FAILED);
  }
}

/** Fetches a URL with a timeout and a hard cap on how much of the body is read. */
async function fetchCapped(url, { maxBytes = MAX_RESPONSE_BYTES, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain,*/*' },
    });
    if (!res.ok) {
      throw new BadRequestError(`${url} returned HTTP ${res.status}`, ERROR_CODES.VERIFICATION_FAILED);
    }
    if (!res.body) return '';
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > maxBytes) {
        // eslint-disable-next-line no-await-in-loop
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'AbortError') {
      throw new BadRequestError(`Timed out fetching ${url}`, ERROR_CODES.VERIFICATION_FAILED);
    }
    throw new BadRequestError(`Could not reach ${url}`, ERROR_CODES.VERIFICATION_FAILED);
  } finally {
    clearTimeout(timer);
  }
}

/** Tries https first, falls back to http - most sites redirect, some don't have TLS yet. */
async function fetchFromDomain(domain, pathname = '/') {
  await assertPublicHostname(domain);
  let lastErr;
  for (const scheme of ['https', 'http']) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fetchCapped(`${scheme}://${domain}${pathname}`);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// The three proof-of-ownership checks. Each throws a BadRequestError with a
// user-facing reason on failure, or resolves silently on success.
// ---------------------------------------------------------------------------

async function checkDnsTxt(website, token) {
  await assertPublicHostname(website.domain);
  const expected = `${DNS_TXT_KEY}=${token}`;

  let records;
  try {
    records = await dns.resolveTxt(website.domain);
  } catch (err) {
    throw new BadRequestError(
      `No TXT records were found on ${website.domain} (${err.code || 'lookup failed'})`,
      ERROR_CODES.VERIFICATION_FAILED,
    );
  }

  const found = records.map((chunks) => chunks.join('').trim()).includes(expected);
  if (!found) {
    throw new BadRequestError(
      `No TXT record on ${website.domain} matched the expected verification value`,
      ERROR_CODES.VERIFICATION_FAILED,
    );
  }
}

async function checkMetaTag(website, token) {
  const html = await fetchFromDomain(website.domain, '/');
  const nameFirst = new RegExp(`<meta[^>]+name=["']${META_TAG_NAME}["'][^>]+content=["']${token}["']`, 'i');
  const contentFirst = new RegExp(`<meta[^>]+content=["']${token}["'][^>]+name=["']${META_TAG_NAME}["']`, 'i');
  if (!nameFirst.test(html) && !contentFirst.test(html)) {
    throw new BadRequestError(
      `No <meta name="${META_TAG_NAME}"> tag with the expected token was found on the homepage`,
      ERROR_CODES.VERIFICATION_FAILED,
    );
  }
}

async function checkFileUpload(website, token) {
  const content = await fetchFromDomain(website.domain, `/${verificationFileName(token)}`);
  if (content.trim() !== token) {
    throw new BadRequestError(
      'The verification file was reachable but its content did not match the token',
      ERROR_CODES.VERIFICATION_FAILED,
    );
  }
}

const CHECKERS = Object.freeze({
  [VERIFICATION_METHODS.DNS_TXT]: checkDnsTxt,
  [VERIFICATION_METHODS.META_TAG]: checkMetaTag,
  [VERIFICATION_METHODS.FILE_UPLOAD]: checkFileUpload,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function buildInstructions(website, token) {
  const { domain } = website;
  return {
    token,
    status: website.verificationStatus,
    verifiedAt: website.verifiedAt || null,
    lastVerificationAttemptAt: website.lastVerificationAttemptAt || null,
    lastVerificationError: website.lastVerificationError || null,
    methods: {
      [VERIFICATION_METHODS.DNS_TXT]: {
        summary: `Add a TXT record on ${domain} with the value below, then verify.`,
        recordType: 'TXT',
        host: domain,
        value: `${DNS_TXT_KEY}=${token}`,
      },
      [VERIFICATION_METHODS.META_TAG]: {
        summary: `Paste this tag into the <head> of https://${domain}/, then verify.`,
        tag: `<meta name="${META_TAG_NAME}" content="${token}" />`,
      },
      [VERIFICATION_METHODS.FILE_UPLOAD]: {
        summary: 'Upload a text file with only the token as its content, reachable at the URL below, then verify.',
        fileName: verificationFileName(token),
        url: `https://${domain}/${verificationFileName(token)}`,
        content: token,
      },
    },
  };
}

/** Loads the website, issuing a token on first access so instructions are always available. */
async function getOrCreateToken(workspaceId, websiteId) {
  const id = requireObjectId(websiteId, 'Website');
  let website = await websiteRepository.findOneInWorkspaceWithToken(workspaceId, id);
  if (!website) throw new NotFoundError('Website not found');

  if (!website.verificationToken) {
    const token = generateToken();
    website = await websiteRepository.updateInWorkspace(workspaceId, id, { $set: { verificationToken: token } });
    website.verificationToken = token; // updateInWorkspace's projection hides it again
  }
  return website;
}

async function getInstructions(workspaceId, websiteId) {
  const website = await getOrCreateToken(workspaceId, websiteId);
  return buildInstructions(website, website.verificationToken);
}

async function rotateToken(workspace, actor, websiteId) {
  const id = requireObjectId(websiteId, 'Website');
  const token = generateToken();

  const website = await websiteRepository.updateInWorkspace(workspace._id, id, {
    $set: {
      verificationToken: token,
      verificationStatus: VERIFICATION_STATUS.UNVERIFIED,
      verificationMethod: null,
      verifiedAt: null,
      lastVerificationAttemptAt: null,
      lastVerificationError: null,
    },
  });
  if (!website) throw new NotFoundError('Website not found');

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.WEBSITE_VERIFICATION_TOKEN_ROTATED,
    resource: 'website',
    resourceId: website._id,
    metadata: { domain: website.domain },
  });

  return buildInstructions(website, token);
}

/**
 * Runs the live check for one method and persists the outcome either way, so
 * the dashboard can show *why* it failed rather than just that it did.
 */
async function verifyWebsite(workspace, actor, websiteId, method) {
  if (!CHECKERS[method]) {
    throw new BadRequestError('Unknown verification method', ERROR_CODES.VALIDATION_ERROR);
  }

  const id = requireObjectId(websiteId, 'Website');
  const website = await websiteRepository.findOneInWorkspaceWithToken(workspace._id, id);
  if (!website) throw new NotFoundError('Website not found');

  if (website.verificationStatus === VERIFICATION_STATUS.VERIFIED) {
    return serializeWebsite(website); // already proven; don't re-hit the network
  }
  if (!website.verificationToken) {
    throw new BadRequestError('Generate a verification token before verifying', ERROR_CODES.VALIDATION_ERROR);
  }

  try {
    await CHECKERS[method](website, website.verificationToken);

    const verified = await websiteRepository.updateInWorkspace(workspace._id, id, {
      $set: {
        verificationStatus: VERIFICATION_STATUS.VERIFIED,
        verificationMethod: method,
        verifiedAt: new Date(),
        lastVerificationAttemptAt: new Date(),
        lastVerificationError: null,
      },
    });

    await auditLogService.log({
      workspace: workspace._id,
      actor: actor._id,
      action: AUDIT_ACTIONS.WEBSITE_VERIFIED,
      resource: 'website',
      resourceId: website._id,
      metadata: { domain: website.domain, method },
    });

    return serializeWebsite(verified);
  } catch (err) {
    const message = err instanceof AppError ? err.message : 'Verification check failed';

    await websiteRepository.updateInWorkspace(workspace._id, id, {
      $set: {
        verificationStatus: VERIFICATION_STATUS.FAILED,
        lastVerificationAttemptAt: new Date(),
        lastVerificationError: message.slice(0, 300),
      },
    });

    logger.info({ websiteId: String(id), method, reason: message }, 'website verification check failed');

    await auditLogService.log({
      workspace: workspace._id,
      actor: actor._id,
      action: AUDIT_ACTIONS.WEBSITE_VERIFICATION_FAILED,
      resource: 'website',
      resourceId: website._id,
      metadata: { domain: website.domain, method },
    });

    if (err instanceof AppError) throw err;
    throw new BadRequestError(message, ERROR_CODES.VERIFICATION_FAILED);
  }
}

module.exports = {
  getInstructions,
  rotateToken,
  verifyWebsite,
};
