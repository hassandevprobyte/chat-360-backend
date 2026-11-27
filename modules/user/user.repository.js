const User = require("./user.model");

// Common
const normalizers = require("../../common/normalizers");

const POPULATION_PIPELINE = [];

exports.getAllUsers = async (filters) => {
  return User.find(filters, "-password").sort({ name: 1 }).populate(POPULATION_PIPELINE).lean();
};

exports.getUsersWithPagination = async (filters, offset, pageSize, sort) => {
  return User.find(filters, "-password").skip(offset).limit(pageSize).sort(sort).populate(POPULATION_PIPELINE).lean();
};

exports.getUsersCount = async (filters) => {
  return User.countDocuments(filters);
};

exports.getUserById = async (userId) => {
  return User.findById(userId, "-password").populate(POPULATION_PIPELINE).lean();
};

exports.getUsersByIds = async (userIds) => {
  return User.find({ _id: { $in: normalizers.normalizeToArray(userIds) } })
    .populate(POPULATION_PIPELINE)
    .lean();
};

exports.getUserPasswordById = async (userId) => {
  const user = await User.findById(userId, "password");

  return user ? user.password : null;
};

exports.getUserByEmail = async (email) => {
  return User.findOne({ email });
};

exports.getUserByRoleId = async (roleId) => {
  return User.findOne({ roles: roleId });
};

exports.createUser = async (payload) => {
  return User.create(payload);
};

exports.updateUserById = async (userId, payload) => {
  return User.findByIdAndUpdate(userId, payload, { returnDocument: "after" });
};

exports.deleteUserById = async (userId) => {
  return User.findByIdAndDelete(userId);
};
