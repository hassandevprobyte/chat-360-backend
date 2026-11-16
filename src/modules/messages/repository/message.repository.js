'use strict';

const Message = require('../model/message.model');
const { SENDER_TYPES, MESSAGE_TYPES, VISITOR_VISIBLE_MESSAGE_TYPES } = require('../../../common/constants');

const create = (data) => Message.create(data);

/** Workspace + conversation scoped. There is no `findById` on purpose. */
const findOneInWorkspace = (workspace, id) => Message.findOne({ _id: id, workspace }).lean();

/**
 * Cursor page. The caller supplies the already-built filter (including the
 * cursor fragment) so pagination stays in one shared utility.
 */
const findPage = (filter, limit) =>
  Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();

/** Visitor-facing history: INTERNAL_NOTE can never appear in the result set. */
const findVisitorPage = (filter, limit) =>
  Message.find({ ...filter, type: { $in: VISITOR_VISIBLE_MESSAGE_TYPES }, deletedAt: null })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();

const updateInWorkspace = (workspace, id, update) =>
  Message.findOneAndUpdate({ _id: id, workspace }, update, { new: true, runValidators: true }).lean();

/**
 * Marks the *other* side's messages as read.
 * `bySenderTypes` is the set of senders whose messages the reader did not write.
 */
const markRead = (workspace, conversation, bySenderTypes, at = new Date()) =>
  Message.updateMany(
    { workspace, conversation, senderType: { $in: bySenderTypes }, readAt: null },
    { $set: { readAt: at } },
  );

const markDelivered = (workspace, id, at = new Date()) =>
  Message.updateOne({ _id: id, workspace, deliveredAt: null }, { $set: { deliveredAt: at } });

const countDocuments = (filter = {}) => Message.countDocuments(filter);

const aggregate = (pipeline) => Message.aggregate(pipeline);

/** First visitor-visible agent reply in a conversation; kept for reporting. */
const findFirstAgentReply = (workspace, conversation) =>
  Message.findOne({
    workspace,
    conversation,
    senderType: SENDER_TYPES.USER,
    type: { $ne: MESSAGE_TYPES.INTERNAL_NOTE },
  })
    .sort({ createdAt: 1 })
    .lean();

module.exports = {
  create,
  findOneInWorkspace,
  findPage,
  findVisitorPage,
  updateInWorkspace,
  markRead,
  markDelivered,
  countDocuments,
  aggregate,
  findFirstAgentReply,
};
