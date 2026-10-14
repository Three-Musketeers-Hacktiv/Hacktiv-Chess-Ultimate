"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Game extends Model {
    static associate(models) {
      Game.belongsTo(models.User, { foreignKey: "white_player_id", as: "whitePlayer" });
      Game.belongsTo(models.User, { foreignKey: "black_player_id", as: "blackPlayer" });
      Game.belongsTo(models.User, { foreignKey: "draw_offer_by_player_id", as: "drawOfferBy" });
      Game.hasMany(models.GameMove, { foreignKey: "game_id", as: "moves" });
    }
  }

  Game.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      mode: { type: DataTypes.STRING(8), allowNull: false },
      status: { type: DataTypes.STRING(16), allowNull: false },
      time_control_minutes: { type: DataTypes.SMALLINT, allowNull: false },
      increment_seconds: { type: DataTypes.SMALLINT, allowNull: false },
      bot_difficulty: { type: DataTypes.STRING(8), allowNull: true },
      white_player_id: { type: DataTypes.UUID, allowNull: false },
      black_player_id: { type: DataTypes.UUID, allowNull: true },
      current_fen: { type: DataTypes.TEXT, allowNull: false },
      white_time_remaining_ms: { type: DataTypes.BIGINT, allowNull: false },
      black_time_remaining_ms: { type: DataTypes.BIGINT, allowNull: false },
      turn_started_at: { type: DataTypes.DATE, allowNull: true },
      draw_offer_by_player_id: { type: DataTypes.UUID, allowNull: true },
      result: { type: DataTypes.STRING(7), allowNull: true },
      termination_reason: { type: DataTypes.STRING(32), allowNull: true },
      started_at: { type: DataTypes.DATE, allowNull: true },
      ended_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: "Game",
      tableName: "games",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  return Game;
};
