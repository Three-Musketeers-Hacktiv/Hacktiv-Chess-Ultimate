"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("users", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        username: { type: Sequelize.STRING(24), allowNull: false },
        email: { type: Sequelize.STRING(254), allowNull: false },
        password_hash: { type: Sequelize.STRING(255), allowNull: false },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      }, { transaction });

      await queryInterface.addIndex("users", ["username"], {
        unique: true,
        name: "users_username_unique",
        transaction,
      });
      await queryInterface.addIndex("users", ["email"], {
        unique: true,
        name: "users_email_unique",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("users", { transaction });
    });
  },
};
