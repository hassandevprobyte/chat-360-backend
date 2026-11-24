const asyncHandler = require("express-async-handler");

// Services
const messageService = require("./message.service");

// @desc    Get all messages
// @route   GET /api/v1/messages/all
// @access  Private
exports.getAllMessages = asyncHandler(async (req, res) => {
  const data = await messageService.getAllMessages(req.filters);

  res.status(200).json(data);
});

// @desc    Get messages with pagination
// @route   GET /api/v1/messages
// @access  Private
exports.getMessagesWithPagination = asyncHandler(async (req, res) => {
  const payload = {
    filters: req.filters,
    page: req.pagination.page,
    pageSize: req.pagination.pageSize,
    sort: req.pagination.sort,
  };

  const data = await messageService.getMessagesWithPagination(payload);

  res.status(200).json(data);
});

// @desc    Get Message by id
// @route   GET /api/v1/messages/:id
// @access  Private
exports.getMessageById = asyncHandler(async (req, res) => {
  const data = await messageService.getMessageById(req.params.id);

  res.status(200).json(data);
});

// @desc    Create a new Message
// @route   POST /api/v1/messages
// @access  Private
exports.createMessage = asyncHandler(async (req, res) => {
  const payload = {
    workspace: req.context?.workspace?._id,
    conversation: req.body.conversation,
    senderType: req.body.senderType,
    sender: req.body.sender,
    visitor: req.body.visitor,
    type: req.body.type,
    deliveredAt: req.body.deliveredAt,
    readAt: req.body.readAt,
    editedAt: req.body.editedAt,
    deletedAt: req.body.deletedAt,
    metadata: req.body.metadata,
  };

  const attachmentPayload = {
    attachments: req.files?.attachments,
    uploadedBy: req.context?.user?._id,
  };

  const data = await messageService.createMessage(payload, attachmentPayload);

  res.status(201).json(data);
});

// @desc    Update Message
// @route   PATCH /api/v1/messages/:id
// @access  Private
exports.updateMessage = asyncHandler(async (req, res) => {
  const payload = {
    id: req.params.id,
    workspace: req.context?.workspace?._id,
    conversation: req.body.conversation,
    senderType: req.body.senderType,
    sender: req.body.sender,
    visitor: req.body.visitor,
    type: req.body.type,
    deliveredAt: req.body.deliveredAt,
    readAt: req.body.readAt,
    editedAt: req.body.editedAt,
    deletedAt: req.body.deletedAt,
    metadata: req.body.metadata,
    removedAttachments: req.body.removedAttachments,
  };

  const attachmentPayload = {
    attachments: req.files?.attachments,
    uploadedBy: req.context?.user?._id,
  };

  const data = await messageService.updateMessage(payload, attachmentPayload);

  res.status(200).json(data);
});

// @desc    Delete Message
// @route   DELETE /api/v1/messages/:id
// @access  Private
exports.deleteMessage = asyncHandler(async (req, res) => {
  const data = await messageService.deleteMessage(req.params.id);

  res.status(200).json(data);
});
