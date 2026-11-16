'use strict';

const crypto = require('crypto');
const env = require('../../../config/env');
const {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  ATTACHMENT_RESOURCES,
  ERROR_CODES,
} = require('../../../common/constants');
const {
  BadRequestError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} = require('../../../common/errors');
const { parsePage, pageMeta } = require('../../../common/utils/pagination');
const { requireObjectId, idEquals } = require('../../../common/utils/objectId');
const { safeFileName } = require('../../../common/utils/sanitize');
const logger = require('../../../common/logger');
const { getStorage } = require('../../../services/storage');
const attachmentRepository = require('../repository/attachment.repository');
const conversationRepository = require('../../conversations/repository/conversation.repository');
const { serializeAttachment, serializeAttachmentForVisitor } = require('../serializer');

/**
 * Validates the upload a second time at the service layer.
 *
 * Multer already applied the same rules, but the service is also reachable from
 * tests, the seed script and any future ingestion path, so the check lives with
 * the business logic too.
 */
function assertUploadable(file) {
  if (!file || !file.buffer) throw new BadRequestError('No file was uploaded');

  const mimeType = String(file.mimetype || '').toLowerCase();
  const allowedExtensions = ALLOWED_ATTACHMENT_MIME_TYPES[mimeType];
  if (!allowedExtensions) {
    throw new UnsupportedMediaTypeError(`File type '${mimeType}' is not allowed`);
  }

  const { base, ext } = safeFileName(file.originalname || 'file');
  if (!allowedExtensions.includes(ext)) {
    throw new UnsupportedMediaTypeError(
      `File extension '${ext || 'none'}' does not match the declared type '${mimeType}'`,
    );
  }
  if (file.size > env.storage.maxFileSize) {
    throw new PayloadTooLargeError(
      `Files must be ${Math.floor(env.storage.maxFileSize / 1024 / 1024)}MB or smaller`,
    );
  }

  return { mimeType, base, ext };
}

/**
 * Storage keys are generated entirely server-side and namespaced per workspace,
 * so one tenant can never address another tenant's objects and the client's
 * file name never becomes part of a path.
 */
function buildStorageKey(workspaceId, base, ext) {
  const now = new Date();
  const unique = crypto.randomBytes(12).toString('hex');
  return [
    'workspaces',
    String(workspaceId),
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    `${unique}-${base}${ext}`,
  ].join('/');
}

async function upload({ workspace, file, uploadedBy = null, uploadedByVisitor = null, conversation = null }) {
  const { mimeType, base, ext } = assertUploadable(file);
  const storageKey = buildStorageKey(workspace._id, base, ext);
  const storage = getStorage();

  await storage.save({ key: storageKey, buffer: file.buffer, mimeType });

  const attachment = await attachmentRepository.create({
    workspace: workspace._id,
    resource: conversation ? ATTACHMENT_RESOURCES.CONVERSATION : ATTACHMENT_RESOURCES.MESSAGE,
    resourceId: null,
    conversation: conversation ? conversation._id : null,
    originalName: file.originalname,
    fileName: `${base}${ext}`,
    mimeType,
    size: file.size,
    storageKey,
    storageDriver: storage.driver,
    checksum: crypto.createHash('sha256').update(file.buffer).digest('hex').slice(0, 64),
    uploadedBy,
    uploadedByVisitor,
  });

  logger.info(
    { workspaceId: String(workspace._id), attachmentId: String(attachment._id), mimeType, size: file.size },
    'Attachment stored',
  );

  return attachment.toObject();
}

/**
 * Resolves client-supplied attachment ids for a new message.
 *
 * Verifies tenant ownership and that the uploader is the same actor, which
 * prevents attaching somebody else's file to your own message.
 */
async function resolveForMessage(workspaceId, attachmentIds = [], { uploadedBy, uploadedByVisitor } = {}) {
  if (!attachmentIds.length) return [];

  const ids = [...new Set(attachmentIds.map(String))].map((id) => requireObjectId(id, 'Attachment'));
  const found = await attachmentRepository.findByIds(workspaceId, ids);
  if (found.length !== ids.length) throw new NotFoundError('One or more attachments could not be found');

  found.forEach((attachment) => {
    const ownedByUser = uploadedBy && idEquals(attachment.uploadedBy, uploadedBy);
    const ownedByVisitor = uploadedByVisitor && idEquals(attachment.uploadedByVisitor, uploadedByVisitor);
    if (!ownedByUser && !ownedByVisitor) {
      throw new NotFoundError('One or more attachments could not be found');
    }
    if (attachment.resourceId) {
      throw new BadRequestError('An attachment can only be sent once');
    }
  });

  return found;
}

const bindToMessage = (workspaceId, attachments, { conversationId, messageId }) =>
  attachments.length
    ? attachmentRepository.bindToMessage(workspaceId, attachments.map((a) => a._id), {
        conversation: conversationId,
        messageId,
      })
    : null;

/* -------------------------------- downloads ------------------------------- */

async function getForWorkspace(workspaceId, attachmentId) {
  const attachment = await attachmentRepository.findOneInWorkspace(
    workspaceId,
    requireObjectId(attachmentId, 'Attachment'),
  );
  if (!attachment) throw new NotFoundError('Attachment not found');
  return attachment;
}

/**
 * Visitor download. The attachment must belong to a conversation that this
 * visitor owns - a visitor can never read another visitor's files, even inside
 * the same workspace.
 */
async function getForVisitor({ workspace, visitor }, attachmentId) {
  const attachment = await getForWorkspace(workspace._id, attachmentId);

  if (idEquals(attachment.uploadedByVisitor, visitor._id)) return attachment;
  if (!attachment.conversation) throw new NotFoundError('Attachment not found');

  const conversation = await conversationRepository.findOneInWorkspace(workspace._id, attachment.conversation);
  if (!conversation || !idEquals(conversation.visitor, visitor._id)) {
    throw new NotFoundError('Attachment not found');
  }
  return attachment;
}

/**
 * Returns a readable stream plus the headers to send.
 *
 * Content-Disposition is always `attachment` and the filename is quoted from
 * the sanitised stored name, so an uploaded HTML/SVG file can never execute in
 * the dashboard's origin.
 */
async function openDownload(attachment) {
  const storage = getStorage();
  const signedUrl = await storage.getSignedUrl(attachment.storageKey, 300).catch(() => null);
  if (signedUrl) return { redirectTo: signedUrl };

  const stream = await storage.createReadStream(attachment.storageKey);
  return {
    stream,
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': attachment.size,
      'Content-Disposition': `attachment; filename="${attachment.fileName.replace(/"/g, '')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=0, no-store',
    },
  };
}

async function listAttachments(workspaceId, query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspaceId, deletedAt: null };
  if (query.conversationId) filter.conversation = requireObjectId(query.conversationId, 'Conversation');

  const { items, total } = await attachmentRepository.paginate({ filter, skip, limit });
  return { data: items.map(serializeAttachment), meta: pageMeta({ total, page, limit }) };
}

/** Soft-deletes the record and removes the object from storage. */
async function deleteAttachment(workspaceId, attachmentId) {
  const attachment = await attachmentRepository.softDelete(
    workspaceId,
    requireObjectId(attachmentId, 'Attachment'),
  );
  if (!attachment) throw new NotFoundError('Attachment not found');

  try {
    await getStorage().delete(attachment.storageKey);
  } catch (err) {
    // The record is already gone from the API's point of view; a stranded
    // object is a cleanup concern, not a request failure.
    logger.warn({ err, storageKey: attachment.storageKey }, 'Failed to delete stored object');
  }

  return { deleted: true, attachmentId: String(attachment._id) };
}

module.exports = {
  ERROR_CODES,
  assertUploadable,
  buildStorageKey,
  upload,
  resolveForMessage,
  bindToMessage,
  getForWorkspace,
  getForVisitor,
  openDownload,
  listAttachments,
  deleteAttachment,
  serializeAttachment,
  serializeAttachmentForVisitor,
};
