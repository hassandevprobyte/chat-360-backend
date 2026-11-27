const asyncHandler = require("express-async-handler");

// Services
const conversationService = require("./conversation.service");

// @desc    Get all conversations
// @route   GET /api/v1/conversations/all
// @access  Private
exports.getAllConversations = asyncHandler(async (req, res) => {
  const filters = { ...req.filters, workspace: req.context?.workspace?._id };

  const data = await conversationService.getAllConversations(filters);

  res.status(200).json(data);
});

// @desc    Get conversations with pagination
// @route   GET /api/v1/conversations
// @access  Private
exports.getConversationsWithPagination = asyncHandler(async (req, res) => {
  const payload = {
    filters: { ...req.filters, workspace: req.context?.workspace?._id },
    page: req.pagination.page,
    pageSize: req.pagination.pageSize,
    sort: req.pagination.sort,
  };

  const data = await conversationService.getConversationsWithPagination(payload);

  res.status(200).json(data);
});

// @desc    Get Conversation by id
// @route   GET /api/v1/conversations/:id
// @access  Private
exports.getConversationById = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    id: req.params.id,
  };

  const data = await conversationService.getConversationById(payload);

  res.status(200).json(data);
});

// @desc    Create a new Conversation
// @route   POST /api/v1/conversations
// @access  Private
exports.createConversation = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    website: req.body.website,
    widget: req.body.widget,
    visitor: req.body.visitor,
    assignedTo: req.body.assignedTo,
    assignedAt: req.body.assignedAt,
    status: req.body.status,
    priority: req.body.priority,
    subject: req.body.subject,
    tags: req.body.tags,
    lastMessage: req.body.lastMessage,
    lastMessageAt: req.body.lastMessageAt,
    firstResponseAt: req.body.firstResponseAt,
    firstAgentReplyBy: req.body.firstAgentReplyBy,
    closedAt: req.body.closedAt,
    closedBy: req.body.closedBy,
    reopenedAt: req.body.reopenedAt,
    messageCount: req.body.messageCount,
    visitorUnreadCount: req.body.visitorUnreadCount,
    agentUnreadCount: req.body.agentUnreadCount,
    visitorLastReadAt: req.body.visitorLastReadAt,
    agentLastReadAt: req.body.agentLastReadAt,
    startedPage: req.body.startedPage,
    metadata: req.body.metadata,
  };

  const data = await conversationService.createConversation(payload);

  res.status(201).json(data);
});

// @desc    Update Conversation
// @route   PATCH /api/v1/conversations/:id
// @access  Private
exports.updateConversation = asyncHandler(async (req, res) => {
  const payload = {
    id: req.params.id,
    workspace: req.context?.workspace?._id,
    website: req.body.website,
    widget: req.body.widget,
    visitor: req.body.visitor,
    assignedTo: req.body.assignedTo,
    assignedAt: req.body.assignedAt,
    status: req.body.status,
    priority: req.body.priority,
    subject: req.body.subject,
    tags: req.body.tags,
    lastMessage: req.body.lastMessage,
    lastMessageAt: req.body.lastMessageAt,
    firstResponseAt: req.body.firstResponseAt,
    firstAgentReplyBy: req.body.firstAgentReplyBy,
    closedAt: req.body.closedAt,
    closedBy: req.body.closedBy,
    reopenedAt: req.body.reopenedAt,
    messageCount: req.body.messageCount,
    visitorUnreadCount: req.body.visitorUnreadCount,
    agentUnreadCount: req.body.agentUnreadCount,
    visitorLastReadAt: req.body.visitorLastReadAt,
    agentLastReadAt: req.body.agentLastReadAt,
    startedPage: req.body.startedPage,
    metadata: req.body.metadata,
  };

  const data = await conversationService.updateConversation(payload);

  res.status(200).json(data);
});

// @desc    Delete Conversation
// @route   DELETE /api/v1/conversations/:id
// @access  Private
exports.deleteConversation = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    id: req.params.id,
  };

  const data = await conversationService.deleteConversation(payload);

  res.status(200).json(data);
});
