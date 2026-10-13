"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("games", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        mode: { type: Sequelize.STRING(8), allowNull: false },
        status: { type: Sequelize.STRING(16), allowNull: false },
        time_control_minutes: { type: Sequelize.SMALLINT, allowNull: false },
        increment_seconds: { type: Sequelize.SMALLINT, allowNull: false },
        bot_difficulty: { type: Sequelize.STRING(8), allowNull: true },
        white_player_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        black_player_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        current_fen: { type: Sequelize.TEXT, allowNull: false },
        white_time_remaining_ms: { type: Sequelize.BIGINT, allowNull: false },
        black_time_remaining_ms: { type: Sequelize.BIGINT, allowNull: false },
        turn_started_at: { type: Sequelize.DATE, allowNull: true },
        draw_offer_by_player_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        result: { type: Sequelize.STRING(7), allowNull: true },
        termination_reason: { type: Sequelize.STRING(32), allowNull: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        started_at: { type: Sequelize.DATE, allowNull: true },
        ended_at: { type: Sequelize.DATE, allowNull: true },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      }, { transaction });

      const checks = [
        ["games_mode_check", `"mode" IN ('pvp', 'bot')`],
        ["games_status_check", `"status" IN ('waiting', 'in_progress', 'completed')`],
        [
          "games_time_control_check",
          `("time_control_minutes", "increment_seconds") IN ((1, 0), (3, 2), (15, 10), (60, 30))`,
        ],
        [
          "games_mode_players_check",
          `(
            ("mode" = 'pvp' AND "bot_difficulty" IS NULL AND
              (("status" = 'waiting' AND "black_player_id" IS NULL) OR
               ("status" IN ('in_progress', 'completed') AND "black_player_id" IS NOT NULL)))
            OR
            ("mode" = 'bot' AND "bot_difficulty" IN ('easy', 'medium', 'hard') AND
              "black_player_id" IS NULL AND "status" IN ('in_progress', 'completed'))
          )`,
        ],
        [
          "games_distinct_players_check",
          `"black_player_id" IS NULL OR "white_player_id" <> "black_player_id"`,
        ],
        [
          "games_bot_difficulty_check",
          `"bot_difficulty" IS NULL OR "bot_difficulty" IN ('easy', 'medium', 'hard')`,
        ],
        [
          "games_clocks_nonnegative_check",
          `"white_time_remaining_ms" >= 0 AND "black_time_remaining_ms" >= 0`,
        ],
        [
          "games_draw_offer_check",
          `"draw_offer_by_player_id" IS NULL OR
            ("mode" = 'pvp' AND "status" = 'in_progress' AND
              ("draw_offer_by_player_id" = "white_player_id" OR
               ("black_player_id" IS NOT NULL AND "draw_offer_by_player_id" = "black_player_id")))`,
        ],
        [
          "games_result_check",
          `"result" IS NULL OR "result" IN ('1-0', '0-1', '1/2-1/2')`,
        ],
        [
          "games_termination_reason_check",
          `"termination_reason" IS NULL OR "termination_reason" IN
            ('checkmate', 'stalemate', 'dead_position', 'resignation', 'timeout', 'draw_agreement',
             'threefold_repetition', 'fivefold_repetition', 'fifty_move_rule', 'seventy_five_move_rule')`,
        ],
        [
          "games_lifecycle_check",
          `("status" = 'waiting' AND "started_at" IS NULL AND "ended_at" IS NULL AND
              "turn_started_at" IS NULL AND "result" IS NULL AND "termination_reason" IS NULL)
            OR
            ("status" = 'in_progress' AND "started_at" IS NOT NULL AND "ended_at" IS NULL AND
              "turn_started_at" IS NOT NULL AND "result" IS NULL AND "termination_reason" IS NULL)
            OR
            ("status" = 'completed' AND "started_at" IS NOT NULL AND "ended_at" IS NOT NULL AND
              "turn_started_at" IS NULL AND "result" IS NOT NULL AND "termination_reason" IS NOT NULL)`,
        ],
      ];

      for (const [name, expression] of checks) {
        await queryInterface.addConstraint("games", {
          fields: ["id"],
          type: "check",
          name,
          where: Sequelize.literal(expression),
          transaction,
        });
      }

      await queryInterface.addIndex("games", ["white_player_id", "created_at"], {
        name: "games_white_player_created_at_idx",
        transaction,
      });
      await queryInterface.addIndex("games", ["black_player_id", "created_at"], {
        name: "games_black_player_created_at_idx",
        transaction,
      });
      await queryInterface.addIndex("games", ["mode", "status", "created_at"], {
        name: "games_mode_status_created_at_idx",
        transaction,
      });
      await queryInterface.addIndex("games", ["turn_started_at"], {
        name: "games_turn_started_at_idx",
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("games", { transaction });
    });
  },
};
