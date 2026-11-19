const seed = require("./seed");

// Configs
const { connectDB } = require("../config/db");

// Jobs
const { createWorkers } = require("../jobs/workers");

const bootstrap = async () => {
  await connectDB();
  createWorkers();

  await seed.seedSuperAdmin();

  console.log("App bootstrapped successfully".bgGreen.white);
};

module.exports = bootstrap;
