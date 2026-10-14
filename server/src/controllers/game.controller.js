const gameService = require("../services/game.service");

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
    io.to(`game:${id}`).emit("game_over", {
      room_id: id, status: "completed", termination_reason: result.game.termination_reason,
      winner: result.game.result === "1-0" ? result.white : result.game.result === "0-1" ? result.black : null,
      result: result.game.result, pgn: result.pgn || null, clocks: result.game.clocks,
    });
  }
}

function sendTimeout(response, result) {
  if (!result.timedOut) return false;
  response.status(409).json({ status: "error", code: "GAME_TIMEOUT", message: "Waktu pemain yang sedang berjalan sudah habis.", game: result.game });
  return true;
}

const asyncHandler = (handler) => async (request, response, next) => {
  try { await handler(request, response, next); }
  catch (error) {
    try { sendError(response, error); }
    catch (unexpected) { next(unexpected); }
  }
};

const createGame = asyncHandler(async (request, response) => {
  const result = await gameService.createRoom(request.user.id, request.body);
  response.status(201).json({ status: "success", game: result.game });
});

const listOpen = asyncHandler(async (_request, response) => {
  response.json({ status: "success", games: await gameService.listOpenRooms() });
});

const listLive = asyncHandler(async (_request, response) => {
  response.json({ status: "success", games: await gameService.listLiveGames() });
});

const joinGame = asyncHandler(async (request, response) => {
  const result = await gameService.joinRoom(request.user.id, request.params.id, new Date());
  response.json({ status: "success", game: result.game });
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
  response.json({
    status: "success", move: result.move || null, bot_move: null, bot_move_pending: false,
    fen: result.game.fen, pgn: result.pgn || null,
    history: result.history?.map((item) => ({
      ply: item.ply, color: item.color, actor: item.color === "w" ? result.white : result.black, from: item.from_square,
      to: item.to_square, promotion: item.promotion, san: item.san, fen_after: item.fen_after,
    })) || [],
    clocks: result.game.clocks, game_status: result.game.status, result: result.game.result,
    termination_reason: result.game.termination_reason,
  });
});

const getGame = asyncHandler(async (request, response) => {
  const result = await gameService.getGame(request.user.id, request.params.id);
  response.json({ status: "success", game: { ...result.game, white: result.white, black: result.black, pgn: result.pgn, history: result.history } });
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

module.exports = { createGame, listOpen, listLive, joinGame, makeMove, getGame, resign, offerDraw, respondDraw, claimDraw };
