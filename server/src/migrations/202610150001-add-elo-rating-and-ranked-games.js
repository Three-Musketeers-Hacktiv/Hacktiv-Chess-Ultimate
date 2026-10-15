"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn("users", "elo_rating", {
        type: Sequelize.INTEGER, allowNull: false, defaultValue: 1500,
      }, { transaction });
      await queryInterface.addConstraint("users", {
        fields: ["elo_rating"],
        type: "check",
        name: "users_elo_rating_check",
        where: Sequelize.literal(`"elo_rating" >= 0`),
        transaction,
      });

      await queryInterface.addColumn("games", "is_ranked", {
        type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
      }, { transaction });
      // Ratings of both players when the game started, and the movement booked when it ended.
      for (const column of ["white_elo_before", "black_elo_before", "white_elo_change", "black_elo_change"]) {
        await queryInterface.addColumn("games", column, { type: Sequelize.INTEGER, allowNull: true }, { transaction });
      }
      await queryInterface.addConstraint("games", {
        fields: ["id"],
        type: "check",
        name: "games_ranked_pvp_check",
        where: Sequelize.literal(`"is_ranked" = false OR "mode" = 'pvp'`),
        transaction,
      });
      // Ranked queue lookup: waiting ranked rooms of one preset, nearest rating first.
      await queryInterface.addIndex("games", ["is_ranked", "status", "time_control_minutes", "white_elo_before"], {
        name: "games_ranked_queue_idx",
        where: { mode: "pvp", status: "waiting" },
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("games", "games_ranked_queue_idx", { transaction });
      await queryInterface.removeConstraint("games", "games_ranked_pvp_check", { transaction });
      for (const column of ["black_elo_change", "white_elo_change", "black_elo_before", "white_elo_before", "is_ranked"]) {
        await queryInterface.removeColumn("games", column, { transaction });
      }
      await queryInterface.removeConstraint("users", "users_elo_rating_check", { transaction });
      await queryInterface.removeColumn("users", "elo_rating", { transaction });
    });
  },
};
