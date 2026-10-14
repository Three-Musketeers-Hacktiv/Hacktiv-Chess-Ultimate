"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addIndex("games", ["white_player_id"], {
        name: "games_one_waiting_pvp_per_player_unique",
        unique: true,
        where: { mode: "pvp", status: "waiting" },
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex("games", "games_one_waiting_pvp_per_player_unique", { transaction });
    });
  },
};
