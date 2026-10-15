"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Puzzle extends Model {}

  Puzzle.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      fen: { type: DataTypes.TEXT, allowNull: false },
      solution: { type: DataTypes.JSONB, allowNull: false },
      difficulty: { type: DataTypes.ENUM("easy", "medium", "hard"), allowNull: false },
      description: { type: DataTypes.STRING(280), allowNull: false },
    },
    {
      sequelize,
      modelName: "Puzzle",
      tableName: "puzzles",
      underscored: true,
      updatedAt: false,
    },
  );

  return Puzzle;
};
