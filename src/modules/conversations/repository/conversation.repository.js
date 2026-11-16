'use strict';

const Conversation = require('../model/conversation.model');
const { CONVERSATION_STATUS } = require('../../../common/constants');

const create = (data) => Conversation.create(data);

/**
 * Workspace-scoped read. This is the only way the rest of the codebase loads a
 * conversation - `findById` is deliberately not exported, which makes IDOR
 * across tenants structurally impossible.
 */
const findOneInWorkspace = (workspace, id) => Conversation.findOne({ _id: id, workspace }).lean();

const findActiveForVisitor = (workspace, visitor) =>
  Conversation.findOne({
    workspace,
    visitor,
    status: { $in: [CONVERSATION_STATUS.OPEN, CONVERSATION_STATUS.PENDING] },
  })
    .sort({ lastMessageAt: -1 })
    .lean();

const findPage = (filter, limit) =>
  Conversation.find(filter).sort({ lastMessageAt: -1, _id: -1 }).limit(limit + 1).lean();

const updateInWorkspace = (workspace, id, update) =>
  Conversation.findOneAndUpdate({ _id: id, workspace }, update, { new: true, runValidators: true }).lean();

/**
 * Atomic claim. The `assignedTo: null` predicate is the whole mechanism: the
 * first writer wins and every later claim matches zero documents, so no second
 * agent can overwrite an assignment. Returns null on conflict.
 */
const claimIfUnassigned = (workspace, id, userId) =>
  Conversation.findOneAndUpdate(
    { _id: id, workspace, assignedTo: null },
    { $set: { assignedTo: userId, assignedAt: new Date() } },
    { new: true },
  ).lean();

const assignTo = (workspace, id, userId) =>
  Conversation.findOneAndUpdate(
    { _id: id, workspace },
    { $set: { assignedTo: userId, assignedAt: userId ? new Date() : null } },
    { new: true },
  ).lean();

/** Status transitions are conditional so a double-close is a no-op, not a rewrite. */
const closeIfOpen = (workspace, id, userId) =>
  Conversation.findOneAndUpdate(
    { _id: id, workspace, status: { $ne: CONVERSATION_STATUS.CLOSED } },
    { $set: { status: CONVERSATION_STATUS.CLOSED, closedAt: new Date(), closedBy: userId || null } },
    { new: true },
  ).lean();

const reopenIfClosed = (workspace, id) =>
  Conversation.findOneAndUpdate(
    { _id: id, workspace, status: CONVERSATION_STATUS.CLOSED },
    {
      $set: {
        status: CONVERSATION_STATUS.OPEN,
        reopenedAt: new Date(),
        closedAt: null,
        closedBy: null,
      },
    },
    { new: true },
  ).lean();

/** Records the first visitor-visible agent reply exactly once. */
const setFirstResponse = (workspace, id, userId, at) =>
  Conversation.findOneAndUpdate(
    { _id: id, workspace, firstResponseAt: null },
    { $set: { firstResponseAt: at, firstAgentReplyBy: userId } },
    { new: true },
  ).lean();

/** Removes a deleted tag from every conversation that referenced it. */
const pullTagEverywhere = (workspace, tagId) =>
  Conversation.updateMany({ workspace, tags: tagId }, { $pull: { tags: tagId } });

const countDocuments = (filter = {}) => Conversation.countDocuments(filter);

const aggregate = (pipeline) => Conversation.aggregate(pipeline);

const findByIds = (workspace, ids) => Conversation.find({ workspace, _id: { $in: ids } }).lean();

module.exports = {
  create,
  findOneInWorkspace,
  findActiveForVisitor,
  findPage,
  updateInWorkspace,
  claimIfUnassigned,
  assignTo,
  closeIfOpen,
  reopenIfClosed,
  setFirstResponse,
  pullTagEverywhere,
  countDocuments,
  aggregate,
  findByIds,
};
