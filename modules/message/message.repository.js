const Message = require("./message.model");

const POPULATION_PIPELINE = [{ path: "workspace" }, { path: "conversation" }, { path: "sender" }, { path: "visitor" }, { path: "attachments" }];

exports.getAllMessages = async (filters) => {
  return Message.find(filters).sort({ createdAt: -1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getMessagesWithPagination = async (filters, offset, pageSize, sort) => {
  return Message.find(filters).skip(offset).limit(pageSize).sort(sort).populate(POPULATION_PIPELINE).lean();
};

exports.getMessagesCount = async (filters) => {
  return Message.countDocuments(filters);
};

exports.getMessageById = async (messageId) => {
  return Message.findById(messageId).populate(POPULATION_PIPELINE).lean();
};

exports.createMessage = async (payload) => {
  return Message.create(payload);
};

exports.updateMessageById = async (messageId, payload) => {
  return Message.findByIdAndUpdate(messageId, payload, { returnDocument: "after" });
};

exports.deleteMessageById = async (messageId) => {
  return Message.findByIdAndDelete(messageId);
};
