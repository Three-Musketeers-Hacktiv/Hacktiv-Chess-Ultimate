const { Chess } = require("chess.js");
const { Op, QueryTypes } = require("sequelize");
const { Game, GameMove, User, sequelize } = require("../models");

function buildGamePgn(game, moves) {
  const chess = new Chess();
  for (const move of moves) {
    chess.move({ from: move.from_square, to: move.to_square, promotion: move.promotion || undefined });
  }
  chess.header(
    "Event", "Hacktiv Chess",
    "White", game.whitePlayer.username,
    "Black", game.blackPlayer?.username || `Stockfish (${game.bot_difficulty})`,
    "Result", game.result,
  );
  return chess.pgn();
}

async function getProfile(userId) {
  const [user, [stats], games] = await Promise.all([
    User.findByPk(userId, { attributes: ["id", "username", "elo_rating"] }),
    sequelize.query(
      `SELECT
        COUNT(*) FILTER (WHERE (white_player_id = :userId AND result = '1-0') OR
          (black_player_id = :userId AND result = '0-1'))::integer AS wins,
        COUNT(*) FILTER (WHERE result = '1/2-1/2')::integer AS draws,
        COUNT(*) FILTER (WHERE (white_player_id = :userId AND result = '0-1') OR
          (black_player_id = :userId AND result = '1-0'))::integer AS losses,
        COUNT(*)::integer AS total_games
      FROM games
      WHERE status = 'completed' AND
        (white_player_id = :userId OR black_player_id = :userId)`,
      { replacements: { userId }, type: QueryTypes.SELECT },
    ),
    Game.findAll({
      where: {
        status: "completed",
        [Op.or]: [{ white_player_id: userId }, { black_player_id: userId }],
      },
      attributes: [
        "id", "mode", "bot_difficulty", "white_player_id", "result", "termination_reason", "started_at", "ended_at",
      ],
      include: [
        { model: User, as: "whitePlayer", attributes: ["username"] },
        { model: User, as: "blackPlayer", attributes: ["username"], required: false },
      ],
      order: [["ended_at", "DESC"], ["id", "DESC"]],
      limit: 50,
    }),
  ]);

  if (!user) return null;

  const moveRows = games.length
    ? await GameMove.findAll({
      where: { game_id: { [Op.in]: games.map((game) => game.id) } },
      attributes: ["game_id", "ply", "from_square", "to_square", "promotion"],
      order: [["game_id", "ASC"], ["ply", "ASC"]],
      raw: true,
    })
    : [];
  const movesByGame = new Map();
  for (const move of moveRows) {
    if (!movesByGame.has(move.game_id)) movesByGame.set(move.game_id, []);
    movesByGame.get(move.game_id).push(move);
  }

  return {
    id: user.id,
    username: user.username,
    elo_rating: user.elo_rating,
    stats,
    games: games.map((game) => {
      const isWhite = game.white_player_id === userId;
      return {
        id: game.id,
        mode: game.mode,
        color: isWhite ? "w" : "b",
        opponent: game.mode === "bot"
          ? `Stockfish (${game.bot_difficulty})`
          : isWhite ? game.blackPlayer?.username || null : game.whitePlayer.username,
        result: game.result,
        termination_reason: game.termination_reason,
        started_at: game.started_at,
        ended_at: game.ended_at,
        pgn: buildGamePgn(game, movesByGame.get(game.id) || []),
      };
    }),
  };
}

module.exports = { getProfile };
