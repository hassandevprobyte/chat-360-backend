const seed = require("./seed");

const bootstrap = async () => {
  await seed.seedSuperAdmin();

  console.log("App bootstrapped successfully".bgGreen.white);
};

module.exports = bootstrap;
