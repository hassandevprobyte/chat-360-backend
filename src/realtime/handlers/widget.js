'use strict';

const presence = require('../presence');
const emitter = require('../emitter');
const { EVENTS, ROOMS } = require('../events');
const visitorService = require('../../modules/visitors/service/visitor.service');
const conversationRepository = require('../../modules/conversations/repository/conversation.repository');
const { isObjectId, idEquals } = require('../../common/utils/objectId');

/**
 * Widget (visitor) socket.
 *
 * A visitor socket joins exactly one room - visitor:{id} - and can never join
 * workspace or conversation rooms. Every event it receives is emitted with a
 * visitor-safe serializer by the services, so there is no path by which an
 * INTERNAL_NOTE or a workspace-level event reaches it.
 */
function registerWidgetHandlers(io, socket) {
  const { workspace, visitor } = socket.data;
  socket.join(ROOMS.visitor(visitor.id));

  presence.setVisitorOnline(workspace._id, visitor._id).catch(() => {});

  async function ownsConversation(conversationId) {
    if (!isObjectId(conversationId)) return null;
    const doc = await conversationRepository.findOneInWorkspace(workspace._id, conversationId).catch(() => null);
    return doc && idEquals(doc.visitor, visitor._id) ? doc : null;
  }

  const relayTyping = (event) => async ({ conversationId } = {}) => {
    const doc = await ownsConversation(conversationId);
    if (!doc) return;
    const payload = { conversationId: String(doc._id), visitorId: visitor.id, name: visitor.name || null };
    emitter.toConversation(doc._id, event, payload);
    emitter.toWorkspace(workspace._id, event, payload);
  };

  socket.on('typing:start', relayTyping(EVENTS.TYPING_START));
  socket.on('typing:stop', relayTyping(EVENTS.TYPING_STOP));

  socket.on('activity', ({ page } = {}) => {
    visitorService.trackActivity(workspace._id, visitor._id, { page }).catch(() => {});
  });

  socket.on('heartbeat', () => {
    presence.setVisitorOnline(workspace._id, visitor._id).catch(() => {});
  });

  socket.on('disconnect', async () => {
    // Other tabs of the same visitor keep the room alive; only the last
    // socket leaving marks the visitor offline.
    const remaining = await io.in(ROOMS.visitor(visitor.id)).fetchSockets().catch(() => []);
    if (remaining.length === 0) {
      visitorService.markOffline(workspace._id, visitor._id).catch(() => {});
    }
  });
}

module.exports = { registerWidgetHandlers };
