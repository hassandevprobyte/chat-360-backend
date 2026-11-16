'use strict';

const { MESSAGE_TYPES, SENDER_TYPES } = require('../../common/constants');
const { serializeUserSummary } = require('../users/serializer');
const { serializeVisitorSummary } = require('../visitors/serializer');

const serializeMessageAttachment = (attachment, { downloadUrlBuilder } = {}) => ({
  id: String(attachment.attachment),
  name: attachment.originalName,
  mimeType: attachment.mimeType,
  size: attachment.size,
  url: downloadUrlBuilder ? downloadUrlBuilder(attachment.attachment) : null,
});

/**
 * Agent/dashboard shape. Internal notes are included here - this is the only
 * serializer allowed to emit them.
 */
function serializeMessage(message, { sender, visitor, downloadUrlBuilder } = {}) {
  if (!message) return null;
  return {
    id: String(message._id || message.id),
    conversationId: String(message.conversation),
    senderType: message.senderType,
    type: message.type,
    isInternalNote: message.type === MESSAGE_TYPES.INTERNAL_NOTE,
    content: message.content || '',
    attachments: (message.attachments || []).map((a) => serializeMessageAttachment(a, { downloadUrlBuilder })),
    sender: sender
      ? serializeUserSummary(sender)
      : message.sender
        ? { id: String(message.sender) }
        : null,
    visitor: visitor
      ? serializeVisitorSummary(visitor)
      : message.visitor
        ? { id: String(message.visitor) }
        : null,
    metadata: message.metadata || {},
    deliveredAt: message.deliveredAt || null,
    readAt: message.readAt || null,
    editedAt: message.editedAt || null,
    createdAt: message.createdAt,
  };
}

/**
 * Visitor-facing shape.
 *
 * Returns null for anything the visitor must not see, so a caller that forgets
 * to filter still cannot leak an internal note. Agent identity is reduced to a
 * display name and avatar - no user id, no email.
 */
function serializeMessageForVisitor(message, { sender, downloadUrlBuilder } = {}) {
  if (!message) return null;
  if (message.type === MESSAGE_TYPES.INTERNAL_NOTE) return null;
  if (message.deletedAt) return null;

  return {
    id: String(message._id || message.id),
    conversationId: String(message.conversation),
    senderType: message.senderType,
    type: message.type,
    content: message.content || '',
    attachments: (message.attachments || []).map((a) => serializeMessageAttachment(a, { downloadUrlBuilder })),
    agent:
      message.senderType === SENDER_TYPES.USER && sender
        ? { name: sender.name, avatar: sender.avatar || null }
        : null,
    readAt: message.readAt || null,
    createdAt: message.createdAt,
  };
}

/** Short preview stored on the conversation for inbox lists. */
function buildPreview(message) {
  if (message.content) return String(message.content).slice(0, 200);
  const first = (message.attachments || [])[0];
  if (first) return `[${first.mimeType.startsWith('image/') ? 'Image' : 'File'}] ${first.originalName}`;
  return '';
}

module.exports = { serializeMessage, serializeMessageForVisitor, serializeMessageAttachment, buildPreview };
