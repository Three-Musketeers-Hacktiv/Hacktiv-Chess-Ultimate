const gameService = require("../services/game.service");
const gameAnalysisService = require("../services/game-analysis.service");
const stockfish = require("../services/stockfish.service");

function sendError(response, error) {
  if (error instanceof gameService.GameError) {
    return response.status(error.status).json({ status: "error", code: error.code, message: error.message });
  }
  throw error;
}

function broadcast(request, result) {
  const io = request.app.get("io");
  if (!io || !result?.game) return;
  const id = result.game.id;
  if (result.move) {
    io.to(`game:${id}`).emit("move", {
      room_id: id, move: result.move, fen: result.game.fen, pgn: result.pgn,
      history: result.history?.map((move) => ({ ply: move.ply, color: move.color, san: move.san })),
      game_status: result.game.status, clocks: result.game.clocks,
    });
  }
  if (result.offered_by) {
    io.to(`game:${id}`).emit("draw_offer", { room_id: id, offered_by: result.offered_by_username });
  }
  if (result.decision) {
    io.to(`game:${id}`).emit("draw_response", { room_id: id, decision: result.decision });
  }
  if (result.gameOver || result.game.status === "completed") {
    const botName = result.game.mode === "bot" ? `Stockfish (${result.game.bot_difficulty})` : null;
    io.to(`game:${id}`).emit("game_over", {
      room_id: id, status: "completed", termination_reason: result.game.termination_reason,
      winner: result.game.result === "1-0" ? result.white : result.game.result === "0-1" ? (result.black || botName) : null,
      result: result.game.result, pgn: result.pgn || null, clocks: result.game.clocks,
      ranked: Boolean(result.game.ranked), elo: result.game.elo || null,
    });
  }
}

function broadcastGameStarted(request, result) {
  const io = request.app.get("io");
  if (!io || !result.matched || result.alreadyMatched || result.bot) return;
  const game = { ...result.game };
  delete game.color;
  delete game.opponent;
  const roomId = result.game.id;
  io.to(`user:${result.whitePlayerId}`).emit("game_started", {
    room_id: roomId, color: "w", opponent: result.black, game,
  });
  io.to(`user:${result.blackPlayerId}`).emit("game_started", {
    room_id: roomId, color: "b", opponent: result.white, game,
  });
}

function sendTimeout(response, result) {
  if (!result.timedOut) return false;
  response.status(409).json({ status: "error", code: "GAME_TIMEOUT", message: "Waktu pemain yang sedang berjalan sudah habis.", game: result.game });
  return true;
}

/** A 503 from the engine is invisible to the player's terminal otherwise: say what failed and why. */
function logEngineError(request, error) {
  if (error?.status !== 503 || !String(error.code).startsWith("ENGINE_")) return;
  const detail = error.code === "ENGINE_UNAVAILABLE" ? stockfish.availabilityReport().reason : error.message;
  console.error(`[stockfish] ${request.method} ${request.originalUrl} -> 503 ${error.code}: ${detail}`);
}

const asyncHandler = (handler) => async (request, response, next) => {
  try { await handler(request, response, next); }
  catch (error) {
    logEngineError(request, error);
    try { sendError(response, error); }
    catch (unexpected) { next(unexpected); }
  }
};

const createGame = asyncHandler(async (request, response) => {
  const receivedAt = new Date();
  const result = await gameService.createRoom(request.user.id, request.body, receivedAt);
  respondMatchmaking(request, response, result);
});

/** Shared answer of the PvP queue endpoints: 201 bot game, 200 matched, 202 searching. */
function respondMatchmaking(request, response, result) {
  broadcastGameStarted(request, result);
  response.status(result.bot ? 201 : result.matched ? 200 : 202).json({
    status: "success",
    ...(result.bot ? {} : { matchmaking: { status: result.matched ? "matched" : "searching" } }),
    game: result.game,
  });
}

const joinMatchmaking = asyncHandler(async (request, response) => {
  const result = await gameService.joinMatchmaking(request.user.id, request.body, new Date());
  respondMatchmaking(request, response, result);
});

const listLive = asyncHandler(async (_request, response) => {
  response.json({ status: "success", games: await gameService.listLiveGames() });
});

const listHistory = asyncHandler(async (request, response) => {
  const result = await gameService.listGameHistory(request.user.id, request.query);
  response.json({ status: "success", ...result });
});

const cancelMatchmaking = asyncHandler(async (request, response) => {
  response.json({
    status: "success",
    ...await gameService.cancelMatchmaking(request.user.id, request.params.id),
  });
});

const makeMove = asyncHandler(async (request, response) => {
  const receivedAt = new Date();
  const result = await gameService.makeMove(request.user.id, request.params.id, request.body, receivedAt);
  broadcast(request, result);
  if (result.gameOver && !result.move) {
    return response.status(409).json({
      status: "error", code: "GAME_TIMEOUT", message: "Waktu Anda habis sebelum langkah diterima.",
      game: result.game,
    });
  }
  const botReservation = result.botReservation;
  response.json({
    status: "success", move: result.move || null, bot_move: null, bot_move_pending: Boolean(result.botMovePending),
    fen: result.game.fen, pgn: result.pgn || null,
    history: result.history?.map((item) => ({
      ply: item.ply, color: item.color, actor: item.color === "w" ? result.white : result.black, from: item.from_square,
      to: item.to_square, promotion: item.promotion, san: item.san, fen_after: item.fen_after,
    })) || [],
    clocks: result.game.clocks, game_status: result.game.status, result: result.game.result,
    termination_reason: result.game.termination_reason,
    ranked: Boolean(result.game.ranked), elo: result.game.elo || null,
  });
  if (botReservation) {
    void gameService.playBotMove(request.params.id, botReservation)
      .then((botResult) => broadcast(request, botResult))
      .catch((error) => {
        console.error(`Bot move failed for game ${request.params.id}: ${error.message}`);
        request.app.get("retryBotTurn")?.(request.params.id, (result) => broadcast(request, result));
      });
  }
});

const getGame = asyncHandler(async (request, response) => {
  const result = await gameService.getGame(request.user.id, request.params.id);
  response.json({ status: "success", game: { ...result.game, white: result.white, black: result.black, pgn: result.pgn, history: result.history } });
});

const analyzeGame = asyncHandler(async (request, response) => {
  const result = await gameAnalysisService.analyzeGame(request.user.id, request.params.id);
  response.json({ status: "success", ...result });
});

const analyzePgn = asyncHandler(async (request, response) => {
  const result = await gameAnalysisService.analyzePgn(request.body?.pgn);
  response.json({ status: "success", ...result });
});

const resign = asyncHandler(async (request, response) => {
  const result = await gameService.resign(request.user.id, request.params.id, new Date());
  broadcast(request, result);
  if (sendTimeout(response, result)) return;
  response.json({ status: "success", game: result.game });
});

const offerDraw = asyncHandler(async (request, response) => {
  const result = await gameService.offerDraw(request.user.id, request.params.id, new Date());
  broadcast(request, result);
  if (sendTimeout(response, result)) return;
  response.json({ status: "success", game: result.game });
});

const respondDraw = asyncHandler(async (request, response) => {
  const result = await gameService.respondDraw(request.user.id, request.params.id, request.body?.decision, new Date());
  broadcast(request, result);
  if (sendTimeout(response, result)) return;
  response.json({ status: "success", game: result.game, decision: result.decision });
});

const claimDraw = asyncHandler(async (request, response) => {
  const result = await gameService.claimDraw(request.user.id, request.params.id, request.body?.reason, new Date());
  broadcast(request, result);
  if (sendTimeout(response, result)) return;
  response.status(result.claimAccepted ? 200 : 409).json({
    status: result.claimAccepted ? "success" : "error",
    code: result.claimAccepted ? undefined : "DRAW_CLAIM_INVALID",
    message: result.claimAccepted ? "Klaim remis diterima." : "Klaim remis tidak valid; jam lawan ditambah dua menit.",
    game: result.game,
  });
});

module.exports = { createGame, joinMatchmaking, cancelMatchmaking, listLive, listHistory, makeMove, getGame, analyzeGame, analyzePgn, resign, offerDraw, respondDraw, claimDraw };
