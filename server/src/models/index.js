"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const db = {};
const currentFile = path.basename(__filename);

for (const file of fs
  .readdirSync(__dirname)
  .filter((name) => name.endsWith(".js") && name !== currentFile)) {
  const model = require(path.join(__dirname, file))(sequelize, DataTypes);
  db[model.name] = model;
}

for (const model of Object.values(db)) {
  if (typeof model.associate === "function") {
    model.associate(db);
  }
}

db.sequelize = sequelize;
db.Sequelize = require("sequelize");

module.exports = db;
