"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable("game_moves", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
        game_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "games", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        ply: { type: Sequelize.INTEGER, allowNull: false },
        actor_type: { type: Sequelize.STRING(8), allowNull: false },
        player_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        color: { type: Sequelize.CHAR(1), allowNull: false },
        from_square: { type: Sequelize.CHAR(2), allowNull: false },
        to_square: { type: Sequelize.CHAR(2), allowNull: false },
        promotion: { type: Sequelize.CHAR(1), allowNull: true },
        san: { type: Sequelize.STRING(32), allowNull: false },
        fen_after: { type: Sequelize.TEXT, allowNull: false },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      }, { transaction });

      await queryInterface.addIndex("game_moves", ["game_id", "ply"], {
        unique: true,
        name: "game_moves_game_id_ply_unique",
        transaction,
      });

      const checks = [
        ["game_moves_ply_positive_check", `"ply" > 0`],
        ["game_moves_actor_check", `("actor_type" = 'player' AND "player_id" IS NOT NULL) OR
          ("actor_type" = 'bot' AND "player_id" IS NULL)`],
        ["game_moves_color_check", `"color" IN ('w', 'b')`],
        ["game_moves_squares_check", `"from_square" ~ '^[a-h][1-8]$' AND "to_square" ~ '^[a-h][1-8]$'`],
        ["game_moves_promotion_check", `"promotion" IS NULL OR "promotion" IN ('q', 'r', 'b', 'n')`],
      ];

      for (const [name, expression] of checks) {
        await queryInterface.addConstraint("game_moves", {
          fields: ["id"],
          type: "check",
          name,
          where: Sequelize.literal(expression),
          transaction,
        });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("game_moves", { transaction });
    });
  },
};
