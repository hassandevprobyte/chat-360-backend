'use strict';

const env = require('../../config/env');

/** Download URLs are always API routes - never a storage path or bucket URL. */
const buildDownloadPath = (workspaceId, attachmentId) =>
  `/api/v1/workspaces/${workspaceId}/attachments/${attachmentId}/download`;

const buildVisitorDownloadPath = (attachmentId) => `/api/v1/public/attachments/${attachmentId}/download`;

const absolute = (pathname) => `${env.app.url.replace(/\/$/, '')}${pathname}`;

function serializeAttachment(attachment) {
  if (!attachment) return null;
  return {
    id: String(attachment._id || attachment.id),
    name: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    isImage: String(attachment.mimeType || '').startsWith('image/'),
    conversationId: attachment.conversation ? String(attachment.conversation) : null,
    downloadUrl: absolute(buildDownloadPath(attachment.workspace, attachment._id || attachment.id)),
    createdAt: attachment.createdAt,
  };
}

/** Visitor shape: no workspace id, no uploader identity. */
function serializeAttachmentForVisitor(attachment) {
  if (!attachment) return null;
  return {
    id: String(attachment._id || attachment.id),
    name: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    isImage: String(attachment.mimeType || '').startsWith('image/'),
    downloadUrl: absolute(buildVisitorDownloadPath(attachment._id || attachment.id)),
  };
}

module.exports = {
  serializeAttachment,
  serializeAttachmentForVisitor,
  buildDownloadPath,
  buildVisitorDownloadPath,
};
