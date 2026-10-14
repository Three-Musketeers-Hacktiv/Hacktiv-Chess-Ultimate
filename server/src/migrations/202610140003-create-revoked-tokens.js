"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("revoked_tokens", {
        token_hash: { type: Sequelize.CHAR(64), allowNull: false, primaryKey: true },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      }, { transaction });
      await queryInterface.addIndex("revoked_tokens", ["expires_at"], {
        name: "revoked_tokens_expires_at_idx",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("revoked_tokens", { transaction });
    });
  },
};
