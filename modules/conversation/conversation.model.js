const mongoose = require("mongoose");

// Constants
const { CONVERSATION_STATUS, CONVERSATION_PRIORITY, MODELS } = require("../../common/constants");

const lastMessagePreviewSchema = {
  _id: false,
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: MODELS.MESSAGE,
    default: null,
  },
  senderType: {
    type: String,
    default: null,
  },
  type: {
    type: String,
    default: null,
  },
  preview: {
    type: String,
    default: null,
    maxlength: 200,
  },
  createdAt: {
    type: Date,
    default: null,
  },
};

const schema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.WORKSPACE,
      required: [true, "workspace is required"],
    },
    website: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.WEBSITE,
      required: [true, "website is required"],
    },
    widget: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.WIDGET,
      required: [true, "widget is required"],
    },
    visitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.VISITOR,
      required: [true, "visitor is required"],
    },
    // null => sits in the unassigned queue, visible to every eligible member.
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.USER,
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(CONVERSATION_STATUS),
      default: CONVERSATION_STATUS.OPEN,
    },
    priority: {
      type: String,
      enum: Object.values(CONVERSATION_PRIORITY),
      default: CONVERSATION_PRIORITY.NORMAL,
    },
    subject: {
      type: String,
      default: null,
      maxlength: 160,
    },
    tags: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: MODELS.TAG }],
      default: [],
    },
    lastMessage: {
      type: lastMessagePreviewSchema,
      default: () => ({}),
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
    firstResponseAt: {
      type: Date,
      default: null,
    },
    firstAgentReplyBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.USER,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODELS.USER,
      default: null,
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    visitorUnreadCount: {
      type: Number,
      default: 0,
    },
    agentUnreadCount: {
      type: Number,
      default: 0,
    },
    visitorLastReadAt: {
      type: Date,
      default: null,
    },
    agentLastReadAt: {
      type: Date,
      default: null,
    },
    startedPage: {
      type: String,
      default: null,
      maxlength: 512,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, versionKey: false },
);

schema.index({ workspace: 1, status: 1, lastMessageAt: -1 });
schema.index({ workspace: 1, assignedTo: 1, status: 1, lastMessageAt: -1 });
schema.index({ workspace: 1, visitor: 1, createdAt: -1 });
schema.index({ workspace: 1, website: 1, createdAt: -1 });
schema.index({ workspace: 1, widget: 1, createdAt: -1 });
schema.index({ workspace: 1, tags: 1 });

module.exports = mongoose.model("Conversation", schema);
