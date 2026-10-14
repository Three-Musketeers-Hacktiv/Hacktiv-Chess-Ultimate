"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class RevokedToken extends Model {}

  RevokedToken.init(
    {
      token_hash: { type: DataTypes.CHAR(64), primaryKey: true, allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: "RevokedToken", tableName: "revoked_tokens", timestamps: false },
  );

  return RevokedToken;
};
