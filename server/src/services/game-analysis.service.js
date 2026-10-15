const { Chess } = require("chess.js");
const { Game, GameMove } = require("../models");
const { GameError } = require("./game.service");
const stockfish = require("./stockfish.service");

const MAX_ANALYZED_PLIES = 60;
const MAX_PGN_LENGTH = 8_000;
const MISTAKE_CENTIPAWNS = 100;
const BLUNDER_CENTIPAWNS = 300;

function fail(status, code, message) {
  throw new GameError(status, code, message);
}

function comparableScore(score) {
  if (Number.isInteger(score.mate)) {
    return Math.sign(score.mate || 1) * (100_000 - Math.abs(score.mate));
  }
  return score.cp;
}

function classifyLoss(centipawnLoss) {
  if (centipawnLoss >= BLUNDER_CENTIPAWNS) return "Blunder";
  if (centipawnLoss >= MISTAKE_CENTIPAWNS) return "Mistake";
  return "Best Move";
}

/**
 * Runs Stockfish over every position of a line and classifies each played move.
 * `legalMoves` are chess.js verbose moves, `positions` the FEN before move 1 plus the FEN after each move.
 * The engine process is owned by `stockfish.service` (reservation queue, timeout, `quit` + kill on every
 * exit path), and the reservation is always released here.
 */
async function evaluateLine(legalMoves, positions) {
  let evaluations;
  let reservation;
  try {
    reservation = stockfish.reserveAnalysis();
    evaluations = await reservation.run(positions);
  } catch (error) {
    if (error instanceof GameError) throw error;
    if (error.status && error.code) throw new GameError(error.status, error.code, error.message);
    throw new GameError(503, "ENGINE_ANALYSIS_FAILED", "Stockfish tidak dapat menyelesaikan analisis.");
  } finally {
    reservation?.release();
  }

  if (evaluations.length !== positions.length) {
    fail(503, "ENGINE_ANALYSIS_FAILED", "Stockfish mengembalikan hasil analisis yang tidak lengkap.");
  }
  if (evaluations.slice(0, legalMoves.length).some((evaluation) => !evaluation.best_move)) {
    fail(503, "ENGINE_ANALYSIS_FAILED", "Stockfish tidak mengembalikan langkah terbaik yang valid.");
  }

  return legalMoves.map((move, index) => {
    const beforeScore = evaluations[index].score;
    const afterScore = evaluations[index + 1].score;
    const before = comparableScore(beforeScore);
    const after = comparableScore(afterScore);
    const moverBefore = move.color === "w" ? before : -before;
    const moverAfter = move.color === "w" ? after : -after;
    const scoreLoss = Math.max(0, Math.round(moverBefore - moverAfter));
    const centipawnLoss = beforeScore.mate === null && afterScore.mate === null ? scoreLoss : null;
    const bestMove = evaluations[index].best_move;
    let bestAlternative = null;
    const bestFrom = bestMove?.slice(0, 2);
    const bestTo = bestMove?.slice(2, 4);
    const bestPromotion = bestMove?.[4];
    if (bestMove && !(move.from === bestFrom && move.to === bestTo && (move.promotion || undefined) === bestPromotion)) {
      const alternativeBoard = new Chess(positions[index]);
      let alternative;
      try {
        alternative = alternativeBoard.move({ from: bestFrom, to: bestTo, promotion: bestPromotion || undefined });
      } catch {
        fail(503, "ENGINE_ANALYSIS_FAILED", "Stockfish mengembalikan langkah alternatif ilegal.");
      }
      if (!alternative) fail(503, "ENGINE_ANALYSIS_FAILED", "Stockfish mengembalikan langkah alternatif ilegal.");
      bestAlternative = alternative.san;
    }

    return {
      ply: index + 1,
      color: move.color,
      move: move.san,
      evaluation: evaluations[index + 1].score,
      centipawn_loss: centipawnLoss,
      label: classifyLoss(scoreLoss),
      best_alternative: bestAlternative,
    };
  });
}

async function analyzeGame(userId, gameId) {
  const game = await Game.findByPk(gameId, {
    attributes: ["id", "status", "result", "termination_reason", "white_player_id", "black_player_id"],
  });
  if (!game) fail(404, "GAME_NOT_FOUND", "Game tidak ditemukan.");
  if (game.white_player_id !== userId && game.black_player_id !== userId) {
    fail(403, "GAME_FORBIDDEN", "Hanya pemain game yang dapat meminta analisis.");
  }
  if (game.status !== "completed") {
    fail(409, "GAME_NOT_COMPLETED", "Analisis hanya tersedia untuk game yang sudah selesai.");
  }

  const moves = await GameMove.findAll({ where: { game_id: game.id }, order: [["ply", "ASC"]] });
  if (moves.length > MAX_ANALYZED_PLIES) {
    fail(422, "ANALYSIS_GAME_TOO_LONG", `Analisis dibatasi hingga ${MAX_ANALYZED_PLIES} langkah.`);
  }
  if (!moves.length) {
    return { game_id: game.id, analyzed_plies: 0, analysis: [] };
  }

  const chess = new Chess();
  const positions = [chess.fen()];
  const legalMoves = [];
  for (let index = 0; index < moves.length; index += 1) {
    const row = moves[index];
    if (row.ply !== index + 1) fail(500, "GAME_HISTORY_INVALID", "Riwayat langkah game tidak lengkap.");
    let move;
    try {
      move = chess.move({ from: row.from_square, to: row.to_square, promotion: row.promotion || undefined });
    } catch {
      move = null;
    }
    if (!move) fail(500, "GAME_HISTORY_INVALID", "Riwayat game memuat langkah yang tidak legal.");
    legalMoves.push(move);
    positions.push(chess.fen());
  }

  const analysis = await evaluateLine(legalMoves, positions);
  return {
    game_id: game.id,
    result: game.result,
    termination_reason: game.termination_reason,
    analyzed_plies: analysis.length,
    analysis,
  };
}

/**
 * `POST /api/game/analyze { pgn }` — review of any legal PGN (full PGN or bare movetext such as
 * `1. e4 e5 2. Nf3`). The text is parsed and replayed by chess.js first, so nothing but verified moves
 * ever reaches the engine, and the same ply limit and engine queue as the stored-game analysis apply.
 */
async function analyzePgn(pgn) {
  if (typeof pgn !== "string" || !pgn.trim()) {
    fail(400, "INVALID_PGN", "pgn wajib berupa teks PGN yang tidak kosong.");
  }
  if (pgn.length > MAX_PGN_LENGTH) fail(413, "PGN_TOO_LARGE", "PGN terlalu panjang.");

  const chess = new Chess();
  try {
    chess.loadPgn(pgn.trim());
  } catch {
    fail(400, "INVALID_PGN", "PGN tidak valid atau memuat langkah yang tidak legal.");
  }

  const legalMoves = chess.history({ verbose: true });
  if (legalMoves.length > MAX_ANALYZED_PLIES) {
    fail(422, "ANALYSIS_GAME_TOO_LONG", `Analisis dibatasi hingga ${MAX_ANALYZED_PLIES} langkah.`);
  }
  if (!legalMoves.length) return { analyzed_plies: 0, result: null, analysis: [] };

  const positions = [legalMoves[0].before, ...legalMoves.map((move) => move.after)];
  const analysis = await evaluateLine(legalMoves, positions);
  const result = chess.header().Result;
  return { result: result && result !== "*" ? result : null, analyzed_plies: analysis.length, analysis };
}

module.exports = { analyzeGame, analyzePgn, MAX_ANALYZED_PLIES, classifyLoss };
