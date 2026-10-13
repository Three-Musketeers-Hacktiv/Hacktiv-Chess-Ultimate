"use strict";

const { Model } = require("sequelize");
const { hash } = require("../helpers/bcrypt");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Game, { foreignKey: "white_player_id", as: "whiteGames" });
      User.hasMany(models.Game, { foreignKey: "black_player_id", as: "blackGames" });
      User.hasMany(models.Game, { foreignKey: "draw_offer_by_player_id", as: "drawOffers" });
      User.hasMany(models.GameMove, { foreignKey: "player_id", as: "moves" });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      username: {
        type: DataTypes.STRING(24),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true, len: [1, 24] },
      },
      email: {
        type: DataTypes.STRING(254),
        allowNull: false,
        unique: true,
        validate: { notEmpty: true, isEmail: true, len: [1, 254] },
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: { notEmpty: true, len: [1, 255] },
      },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  User.beforeValidate((user) => {
    if (typeof user.username === "string") user.username = user.username.trim().toLowerCase();
    if (typeof user.email === "string") user.email = user.email.trim().toLowerCase();
  });

  User.beforeCreate(async (user) => {
    user.password_hash = await hash(user.password_hash);
  });

  return User;
};
