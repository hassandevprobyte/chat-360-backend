const mongoose = require("mongoose");

// Constants
const { MODELS, STATUSES, PLATFORM_ROLES, WORKSPACE_ROLES } = require("../../common/constants");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      lowercase: true,
      trim: true,
      required: [true, "name is required"],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
      required: [true, "email is required"],
    },
    password: {
      type: String,
      required: [true, "password is required"],
    },
    platformRole: {
      type: String,
      enum: Object.values(PLATFORM_ROLES),
      required: [true, "Platform role is required"],
    },
    workspaceRole: {
      type: String,
      enum: Object.values(WORKSPACE_ROLES),
      required: function () {
        return this.platformRole === PLATFORM_ROLES.USER;
      },
    },
    permissions: {
      type: [String],
      required: function () {
        return Boolean(this.workspaceRole);
      },
    },
    status: {
      type: String,
      enum: Object.values(STATUSES.USER),
      default: STATUSES.USER.ACTIVE,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model(MODELS.USER, UserSchema);
