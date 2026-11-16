'use strict';

const { NotFoundError, ForbiddenError } = require('../../../common/errors');
const { ERROR_CODES, WEBSITE_STATUS } = require('../../../common/constants');
const { originToHost } = require('../../../common/utils/sanitize');
const widgetRepository = require('../../widgets/repository/widget.repository');
const websiteRepository = require('../../websites/repository/website.repository');
const workspaceRepository = require('../../workspaces/repository/workspace.repository');
const websiteService = require('../../websites/service/website.service');

/**
 * Resolves the full tenant context for a public widget request.
 *
 * The widget's public key is the ONLY client-supplied identifier the widget
 * API ever trusts, and it is trusted only as a lookup key. Workspace, website
 * and widget are all derived server-side from it; nothing in the request body
 * can redirect a call into another tenant.
 */
async function resolveByPublicKey(publicKey) {
  const widget = await widgetRepository.findByPublicKey(publicKey);
  if (!widget || !widget.isActive) throw new NotFoundError('Widget not found');

  const [website, workspace] = await Promise.all([
    websiteRepository.findOneInWorkspace(widget.workspace, widget.website),
    workspaceRepository.findActiveById(widget.workspace),
  ]);

  // All three failures look identical to the outside world.
  if (!website || website.status === WEBSITE_STATUS.INACTIVE) throw new NotFoundError('Widget not found');
  if (!workspace) throw new NotFoundError('Widget not found');

  return { widget, website, workspace };
}

/** Same, but from the ids carried in a verified visitor token. */
async function resolveByIds({ ws, site, wid }) {
  const [workspace, website, widget] = await Promise.all([
    workspaceRepository.findActiveById(ws),
    websiteRepository.findOneInWorkspace(ws, site),
    widgetRepository.findOneInWorkspace(ws, wid),
  ]);
  if (!workspace || !website || !widget || !widget.isActive) {
    throw new NotFoundError('Widget not found');
  }
  return { widget, website, workspace };
}

/** Origin comes from the Origin header, falling back to Referer for GET beacons. */
function requestOriginHost(req) {
  const origin = req.get('origin') || req.get('referer') || '';
  return origin ? originToHost(origin) : null;
}

function assertOriginAllowed(website, req) {
  if (!websiteService.isOriginAllowed(website, requestOriginHost(req))) {
    throw new ForbiddenError('This widget is not allowed on this origin', ERROR_CODES.ORIGIN_NOT_ALLOWED);
  }
}

module.exports = { resolveByPublicKey, resolveByIds, requestOriginHost, assertOriginAllowed };
