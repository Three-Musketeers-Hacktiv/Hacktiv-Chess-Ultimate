const { Sequelize } = require("sequelize");
const databaseConfig = require("./database");

const environment = process.env.NODE_ENV || "development";
const config = databaseConfig[environment];

if (!config) {
  throw new Error(`Unsupported NODE_ENV: ${environment}`);
}

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  config,
);

module.exports = sequelize;
