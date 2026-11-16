'use strict';

const tokenService = require('../modules/auth/service/token.service');
const userRepository = require('../modules/users/repository/user.repository');
const memberRepository = require('../modules/workspaces/repository/workspaceMember.repository');
const workspaceRepository = require('../modules/workspaces/repository/workspace.repository');
const visitorRepository = require('../modules/visitors/repository/visitor.repository');
const widgetContext = require('../modules/public/service/widgetContext.service');
const authorizationService = require('../modules/workspaces/service/authorization.service');
const { PLATFORM_ROLES } = require('../common/constants');
const { SOCKET_TYPES } = require('./events');

/**
 * Socket.IO handshake authentication.
 *
 * The client declares which kind of socket it is via `auth.type`; the token is
 * then verified with the matching secret. A visitor token can never open a
 * dashboard socket (and vice versa) because the two verifiers reject each
 * other's `typ` claim.
 */
async function authenticateDashboard(socket) {
  const { token, workspaceId } = socket.handshake.auth || {};
  if (!token) throw new Error('Authentication required');

  const payload = tokenService.verifyAccessToken(token);
  const user = await userRepository.findAuthContext(payload.sub);
  if (!user || !user.isActive) throw new Error('Account unavailable');
  if ((user.tokenVersion || 0) !== (payload.tv || 0)) throw new Error('Session is no longer valid');

  socket.data.type = SOCKET_TYPES.DASHBOARD;
  socket.data.user = {
    _id: user._id,
    id: String(user._id),
    name: user.name,
    avatar: user.avatar || null,
    isSuperAdmin: user.platformRole === PLATFORM_ROLES.SUPER_ADMIN,
  };
  // Workspaces this socket has proven membership for (id -> member record).
  socket.data.memberships = new Map();

  if (workspaceId) await joinWorkspace(socket, workspaceId);
}

/** Verifies membership before the socket is allowed into a workspace room. */
async function joinWorkspace(socket, workspaceId) {
  const workspace = await workspaceRepository.findActiveById(workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  const member = await memberRepository.findActiveMembership(workspace._id, socket.data.user._id);
  if (!member || !authorizationService.canHandleConversations(member)) {
    throw new Error('Not a member of this workspace');
  }

  socket.data.memberships.set(String(workspace._id), member);
  return { workspace, member };
}

async function authenticateWidget(socket) {
  const { token } = socket.handshake.auth || {};
  if (!token) throw new Error('Visitor session required');

  const payload = tokenService.verifyVisitorToken(token);
  const { workspace, website, widget } = await widgetContext.resolveByIds(payload);

  const originHost = widgetContext.requestOriginHost({
    get: (h) => socket.handshake.headers[h.toLowerCase()],
  });
  const websiteService = require('../modules/websites/service/website.service');
  if (!websiteService.isOriginAllowed(website, originHost)) throw new Error('Origin not allowed');

  const visitor = await visitorRepository.findOneInWorkspace(workspace._id, payload.sub);
  if (!visitor || visitor.anonymousId !== payload.aid) throw new Error('Visitor session is no longer valid');

  socket.data.type = SOCKET_TYPES.WIDGET;
  socket.data.workspace = workspace;
  socket.data.website = website;
  socket.data.widget = widget;
  socket.data.visitor = { ...visitor, id: String(visitor._id) };
}

/** io.use() middleware. */
async function socketAuth(socket, next) {
  try {
    const type = (socket.handshake.auth || {}).type === SOCKET_TYPES.WIDGET
      ? SOCKET_TYPES.WIDGET
      : SOCKET_TYPES.DASHBOARD;

    if (type === SOCKET_TYPES.WIDGET) await authenticateWidget(socket);
    else await authenticateDashboard(socket);

    return next();
  } catch (err) {
    const error = new Error(err.message || 'Unauthorized');
    error.data = { code: 'UNAUTHORIZED' };
    return next(error);
  }
}

module.exports = { socketAuth, joinWorkspace };
