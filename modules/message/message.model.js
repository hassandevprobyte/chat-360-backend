const mongoose = require("mongoose");

// Constants
const { SENDER_TYPES, MESSAGE_TYPES, MODELS } = require("../../common/constants");

const schema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.WORKSPACE,
      required: [true, "workspace is required"],
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.CONVERSATION,
      required: [true, "conversation is required"],
    },
    senderType: {
      type: String,
      enum: Object.values(SENDER_TYPES),
      required: [true, "sender type is required"],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.USER,
      default: null,
    },
    visitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.VISITOR,
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(MESSAGE_TYPES),
      default: MESSAGE_TYPES.TEXT,
    },
    content: {
      type: String,
      maxlength: 10000,
      default: "",
    },
    attachments: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: MODELS.ATTACHMENT }],
      default: [],
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false, minimize: false },
);

schema.index({ workspace: 1, conversation: 1, createdAt: -1 });
schema.index({ workspace: 1, conversation: 1, _id: -1 });
schema.index({ workspace: 1, createdAt: -1 });
schema.index({ workspace: 1, senderType: 1, createdAt: -1 });
schema.index({ conversation: 1, senderType: 1, readAt: 1 });

module.exports = mongoose.model(MODELS.MESSAGE, schema);
