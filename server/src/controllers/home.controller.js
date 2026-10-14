const { QueryTypes } = require("sequelize");
const { sequelize, User } = require("../models");
const stockfish = require("../services/stockfish.service");

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
      User.findByPk(request.user.id, { attributes: ["id", "username", "elo_rating"] }),
    ]);

    if (!user) {
      return response.status(401).json({ status: "error", message: "Akun tidak ditemukan." });
    }

    const stockfishAvailable = stockfish.isAvailable();

    return response.status(200).json({
      status: "success",
      home: {
        user,
        stats: statsRows[0],
        // Machine-readable capability flags, `available | planned`.
        capabilities: {
          ranked: "available",
          rematch: "available",
          analysis: stockfishAvailable ? "available" : "planned",
          puzzles: "available",
        },
        game_modes: [
          { id: "pvp", label: "PvP", status: "available" },
          { id: "ranked", label: "Ranked", status: "available" },
          { id: "bot", label: "Melawan Bot", status: stockfishAvailable ? "available" : "planned" },
        ],
        features: [
          { id: "profile", label: "Profil dan Statistik", status: "available" },
          { id: "history", label: "Riwayat Permainan", status: "available" },
          { id: "ranked", label: "Matchmaking Ranked (Elo)", status: "available" },
          { id: "rematch", label: "Rematch", status: "available" },
          { id: "analysis", label: "Analisis Permainan", status: stockfishAvailable ? "available" : "planned" },
          { id: "puzzles", label: "Tactical Puzzles", status: "available" },
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
