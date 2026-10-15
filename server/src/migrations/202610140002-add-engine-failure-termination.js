"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint("games", "games_termination_reason_check", { transaction });
      await queryInterface.addConstraint("games", {
        fields: ["id"],
        type: "check",
        name: "games_termination_reason_check",
        where: Sequelize.literal(`"termination_reason" IS NULL OR "termination_reason" IN
          ('checkmate', 'stalemate', 'dead_position', 'resignation', 'timeout', 'draw_agreement',
           'threefold_repetition', 'fivefold_repetition', 'fifty_move_rule', 'seventy_five_move_rule',
           'engine_failure')`),
        transaction,
      });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint("games", "games_termination_reason_check", { transaction });
      await queryInterface.addConstraint("games", {
        fields: ["id"],
        type: "check",
        name: "games_termination_reason_check",
        where: Sequelize.literal(`"termination_reason" IS NULL OR "termination_reason" IN
          ('checkmate', 'stalemate', 'dead_position', 'resignation', 'timeout', 'draw_agreement',
           'threefold_repetition', 'fivefold_repetition', 'fifty_move_rule', 'seventy_five_move_rule')`),
        transaction,
      });
    });
  },
};
