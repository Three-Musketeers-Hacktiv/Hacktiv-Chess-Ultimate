"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "puzzles",
        {
          id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
          fen: { type: Sequelize.TEXT, allowNull: false },
          solution: { type: Sequelize.JSONB, allowNull: false },
          difficulty: { type: Sequelize.ENUM("easy", "medium", "hard"), allowNull: false },
          description: { type: Sequelize.STRING(280), allowNull: false },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
          },
        },
        { transaction },
      );

      await queryInterface.addIndex("puzzles", ["difficulty"], {
        name: "puzzles_difficulty_idx",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("puzzles", { transaction });
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_puzzles_difficulty";', { transaction });
    });
  },
};
