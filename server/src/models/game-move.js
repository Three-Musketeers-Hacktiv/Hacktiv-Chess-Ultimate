"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class GameMove extends Model {
    static associate(models) {
      GameMove.belongsTo(models.Game, { foreignKey: "game_id", as: "game" });
      GameMove.belongsTo(models.User, { foreignKey: "player_id", as: "player" });
    }
  }

  GameMove.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      game_id: { type: DataTypes.UUID, allowNull: false },
      ply: { type: DataTypes.INTEGER, allowNull: false },
      actor_type: { type: DataTypes.STRING(8), allowNull: false },
      player_id: { type: DataTypes.UUID, allowNull: true },
      color: { type: DataTypes.CHAR(1), allowNull: false },
      from_square: { type: DataTypes.CHAR(2), allowNull: false },
      to_square: { type: DataTypes.CHAR(2), allowNull: false },
      promotion: { type: DataTypes.CHAR(1), allowNull: true },
      san: { type: DataTypes.STRING(32), allowNull: false },
      fen_after: { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "GameMove",
      tableName: "game_moves",
      timestamps: false,
    },
  );

  return GameMove;
};
