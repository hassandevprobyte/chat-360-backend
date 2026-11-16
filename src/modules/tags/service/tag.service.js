'use strict';

const { ConflictError, NotFoundError, BadRequestError } = require('../../../common/errors');
const { AUDIT_ACTIONS, ERROR_CODES } = require('../../../common/constants');
const { parsePage, pageMeta } = require('../../../common/utils/pagination');
const { requireObjectId } = require('../../../common/utils/objectId');
const { cleanText } = require('../../../common/utils/sanitize');
const tagRepository = require('../repository/tag.repository');
const conversationRepository = require('../../conversations/repository/conversation.repository');
const auditLogService = require('../../auditLogs/service/auditLog.service');
const { serializeTag } = require('../serializer');

const toNameKey = (name) => String(name).trim().toLowerCase();

async function createTag(workspace, actor, payload) {
  const name = cleanText(payload.name, { maxLength: 40 });
  if (!name) throw new BadRequestError('Tag name is required');

  const nameKey = toNameKey(name);
  if (await tagRepository.findByNameKey(workspace._id, nameKey)) {
    throw new ConflictError('A tag with this name already exists', ERROR_CODES.ALREADY_EXISTS);
  }

  let tag;
  try {
    tag = await tagRepository.create({
      workspace: workspace._id,
      name,
      nameKey,
      color: payload.color,
      description: payload.description ? cleanText(payload.description, { maxLength: 200 }) : null,
      createdBy: actor._id,
    });
  } catch (err) {
    // The unique index is the real guarantee; the check above is only for a
    // friendly message when there is no race.
    if (err.code === 11000) {
      throw new ConflictError('A tag with this name already exists', ERROR_CODES.ALREADY_EXISTS);
    }
    throw err;
  }

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.TAG_CREATED,
    resource: 'tag',
    resourceId: tag._id,
    metadata: { name },
  });

  return serializeTag(tag.toObject());
}

async function listTags(workspaceId, query = {}) {
  const { page, limit, skip } = parsePage(query);
  const filter = { workspace: workspaceId };
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.search) filter.name = { $regex: cleanText(query.search, { maxLength: 40 }), $options: 'i' };

  const { items, total } = await tagRepository.paginate({ filter, skip, limit });
  return { data: items.map(serializeTag), meta: pageMeta({ total, page, limit }) };
}

async function getTag(workspaceId, tagId) {
  const tag = await tagRepository.findOneInWorkspace(workspaceId, requireObjectId(tagId, 'Tag'));
  if (!tag) throw new NotFoundError('Tag not found');
  return serializeTag(tag);
}

async function updateTag(workspace, actor, tagId, payload) {
  const id = requireObjectId(tagId, 'Tag');
  const update = {};

  if (payload.name !== undefined) {
    const name = cleanText(payload.name, { maxLength: 40 });
    const nameKey = toNameKey(name);
    const clash = await tagRepository.findByNameKey(workspace._id, nameKey);
    if (clash && String(clash._id) !== String(id)) {
      throw new ConflictError('A tag with this name already exists', ERROR_CODES.ALREADY_EXISTS);
    }
    update.name = name;
    update.nameKey = nameKey;
  }
  if (payload.color !== undefined) update.color = payload.color;
  if (payload.description !== undefined) {
    update.description = payload.description ? cleanText(payload.description, { maxLength: 200 }) : null;
  }
  if (payload.isActive !== undefined) update.isActive = payload.isActive;
  if (!Object.keys(update).length) throw new BadRequestError('No changes supplied');

  const tag = await tagRepository.updateInWorkspace(workspace._id, id, { $set: update });
  if (!tag) throw new NotFoundError('Tag not found');

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.TAG_UPDATED,
    resource: 'tag',
    resourceId: tag._id,
    metadata: { changed: Object.keys(update) },
  });

  return serializeTag(tag);
}

/** Hard delete plus a $pull from every conversation so no dangling ids remain. */
async function deleteTag(workspace, actor, tagId) {
  const id = requireObjectId(tagId, 'Tag');
  const tag = await tagRepository.deleteInWorkspace(workspace._id, id);
  if (!tag) throw new NotFoundError('Tag not found');

  await conversationRepository.pullTagEverywhere(workspace._id, id);

  await auditLogService.log({
    workspace: workspace._id,
    actor: actor._id,
    action: AUDIT_ACTIONS.TAG_DELETED,
    resource: 'tag',
    resourceId: id,
    metadata: { name: tag.name },
  });

  return { deleted: true, tagId: String(id) };
}

/** Validates client-supplied tag ids against the tenant. Used by conversations. */
async function resolveWorkspaceTags(workspaceId, tagIds = []) {
  const ids = [...new Set(tagIds.map((t) => String(t)))].map((t) => requireObjectId(t, 'Tag'));
  if (!ids.length) return [];
  const tags = await tagRepository.findActiveByIds(workspaceId, ids);
  if (tags.length !== ids.length) throw new NotFoundError('One or more tags do not exist in this workspace');
  return tags;
}

module.exports = {
  createTag,
  listTags,
  getTag,
  updateTag,
  deleteTag,
  resolveWorkspaceTags,
};
