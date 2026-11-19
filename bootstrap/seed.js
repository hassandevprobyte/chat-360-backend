const bcrypt = require("bcrypt");

// Models
const User = require("../modules/user/user.model");

// Constants
const { PLATFORM_ROLES } = require("../common/constants");

const SUPER_ADMIN = {
  title: "super admin",
  email: "superadmin@chat360.com",
  defaultPassword: "Abcd1234",
  platformRole: PLATFORM_ROLES.SUPER_ADMIN,
};

exports.seedSuperAdmin = async () => {
  try {
    await User.findOneAndUpdate(
      { email: SUPER_ADMIN.email },
      {
        $set: {
          permissions: [],
        },
        $setOnInsert: {
          name: SUPER_ADMIN.title,
          email: SUPER_ADMIN.email,
          password: await bcrypt.hash(SUPER_ADMIN.defaultPassword, 10),
          platformRole: SUPER_ADMIN.platformRole,
          isActive: true,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );
  } catch (error) {
    console.error("Error seeding super admin:", error);

    throw error;
  }
};
