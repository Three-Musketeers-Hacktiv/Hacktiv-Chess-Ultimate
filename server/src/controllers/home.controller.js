const { QueryTypes } = require("sequelize");
const { sequelize, User } = require("../models");

const getHome = async (request, response, next) => {
  try {
    const [statsRows, user] = await Promise.all([
      sequelize.query(
        `SELECT
          COUNT(*) FILTER (WHERE (white_player_id = :userId AND result = '1-0') OR
            (black_player_id = :userId AND result = '0-1'))::integer AS wins,
          COUNT(*) FILTER (WHERE result = '1/2-1/2')::integer AS draws,
          COUNT(*) FILTER (WHERE (white_player_id = :userId AND result = '0-1') OR
            (black_player_id = :userId AND result = '1-0'))::integer AS losses
        FROM games
        WHERE status = 'completed' AND
          (white_player_id = :userId OR black_player_id = :userId)`,
        { replacements: { userId: request.user.id }, type: QueryTypes.SELECT },
      ),
      User.findByPk(request.user.id, { attributes: ["id", "username"] }),
    ]);

    if (!user) {
      return response.status(401).json({ status: "error", message: "Akun tidak ditemukan." });
    }

    return response.status(200).json({
      status: "success",
      home: {
        user,
        stats: statsRows[0],
        game_modes: [
          { id: "pvp", label: "PvP", status: "available" },
          { id: "bot", label: "Melawan Bot", status: "available" },
        ],
        features: [
          { id: "history", label: "Riwayat Permainan", status: "planned" },
          { id: "analysis", label: "Analisis Permainan", status: "planned" },
          { id: "daily_puzzle", label: "Puzzle Harian", status: "planned" },
          { id: "tournaments", label: "Turnamen", status: "planned" },
        ],
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getHome };
