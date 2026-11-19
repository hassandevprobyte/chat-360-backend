const Conversation = require("./conversation.model");

const POPULATION_PIPELINE = [
  { path: "workspace" },
  { path: "website" },
  { path: "widget" },
  { path: "visitor" },
  { path: "tags" },
  { path: "firstAgentReplyBy" },
  { path: "closedBy" },
];

exports.getAllConversations = async (filters) => {
  return Conversation.find(filters).sort({ createdAt: -1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getConversationsWithPagination = async (filters, offset, pageSize, sort) => {
  return Conversation.find(filters).skip(offset).limit(pageSize).sort(sort).populate(POPULATION_PIPELINE).lean();
};

exports.getConversationsCount = async (filters) => {
  return Conversation.countDocuments(filters);
};

exports.getConversationById = async (conversationId) => {
  return Conversation.findById(conversationId).populate(POPULATION_PIPELINE).lean();
};

exports.createConversation = async (payload) => {
  return Conversation.create(payload);
};

exports.updateConversationById = async (conversationId, payload) => {
  return Conversation.findByIdAndUpdate(conversationId, payload, { returnDocument: "after" });
};

exports.deleteConversationById = async (conversationId) => {
  return Conversation.findByIdAndDelete(conversationId);
};
