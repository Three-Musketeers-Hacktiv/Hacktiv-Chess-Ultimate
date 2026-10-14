const { randomUUID } = require("node:crypto");
const { Chess } = require("chess.js");
const { Transaction } = require("sequelize");
const { Game, GameMove, User, sequelize } = require("../models");
const { enqueueGameAction } = require("./game-queue.service");

const START_FEN = new Chess().fen();
const TIME_CONTROLS = Object.freeze({
  bullet: { minutes: 1, increment: 0 },
  blitz: { minutes: 3, increment: 2 },
  rapid: { minutes: 15, increment: 10 },
  professional: { minutes: 60, increment: 30 },
});

class GameError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const fail = (status, code, message) => { throw new GameError(status, code, message); };
const remainingField = (color) => color === "w" ? "white_time_remaining_ms" : "black_time_remaining_ms";
const opponentColor = (color) => color === "w" ? "b" : "w";

function clockSnapshot(game, asOf = new Date()) {
  const fen = game.current_fen;
  const activeColor = game.status === "in_progress" ? fen.split(" ")[1] : null;
  const white = Number(game.white_time_remaining_ms);
  const black = Number(game.black_time_remaining_ms);
  const elapsed = game.turn_started_at && activeColor
    ? Math.max(0, asOf.getTime() - new Date(game.turn_started_at).getTime()) : 0;
  return {
    white_ms: Math.max(0, white - (activeColor === "w" ? elapsed : 0)),
    black_ms: Math.max(0, black - (activeColor === "b" ? elapsed : 0)),
    active_color: activeColor,
    as_of: asOf.toISOString(),
  };
}

async function loadHistory(gameId, transaction) {
  return GameMove.findAll({ where: { game_id: gameId }, order: [["ply", "ASC"]], transaction });
}

async function playerNames(game, transaction) {
  const [white, black] = await Promise.all([
    User.findByPk(game.white_player_id, { attributes: ["username"], transaction }),
    game.black_player_id
      ? User.findByPk(game.black_player_id, { attributes: ["username"], transaction })
      : Promise.resolve(null),
  ]);
  return { white: white?.username || null, black: black?.username || null };
}

function buildPgn(history, result = "*") {
  const chess = new Chess();
  for (const item of history) chess.move({ from: item.from_square, to: item.to_square, promotion: item.promotion || undefined });
  chess.header("Result", result);
  return chess.pgn();
}

async function gamePgn(gameId, result, transaction) {
  return buildPgn(await loadHistory(gameId, transaction), result);
}

function positionKey(fen) {
  const parts = fen.split(" ");
  const chess = new Chess(fen);
  const hasLegalEnPassant = chess.moves({ verbose: true }).some((move) => move.flags.includes("e"));
  return [...parts.slice(0, 3), hasLegalEnPassant ? parts[3] : "-"].join(" ");
}

function repetitionCount(history, currentFen) {
  const positions = [START_FEN];
  const chess = new Chess();
  for (const item of history) {
    chess.move({ from: item.from_square, to: item.to_square, promotion: item.promotion || undefined });
    positions.push(chess.fen());
  }
  return positions.filter((fen) => positionKey(fen) === positionKey(currentFen)).length;
}

function isPlayer(game, userId) {
  if (game.white_player_id === userId) return "w";
  if (game.black_player_id === userId) return "b";
  return null;
}

function publicGame(game, color = null, opponent = null, asOf = new Date()) {
  const totalMs = game.time_control_minutes * 60_000;
  const initialSeconds = totalMs / 1000;
  return {
    id: game.id,
    mode: game.mode,
    status: game.status,
    color,
    fen: game.current_fen,
    result: game.result,
    termination_reason: game.termination_reason,
    time_control: {
      id: Object.keys(TIME_CONTROLS).find((id) => TIME_CONTROLS[id].minutes === game.time_control_minutes),
      initial_seconds: initialSeconds,
      increment_seconds: game.increment_seconds,
    },
    clocks: clockSnapshot(game, asOf),
    opponent,
  };
}

async function finishGame(game, { result, reason, endedAt }, transaction) {
  if (game.turn_started_at) {
    const activeColor = game.current_fen.split(" ")[1];
    const field = remainingField(activeColor);
    const elapsed = Math.max(0, endedAt.getTime() - new Date(game.turn_started_at).getTime());
    game[field] = Math.max(0, Number(game[field]) - elapsed);
  }
  game.status = "completed";
  game.result = result;
  game.termination_reason = reason;
  game.ended_at = endedAt;
  game.turn_started_at = null;
  game.draw_offer_by_player_id = null;
  await game.save({ transaction });
}

async function timeoutIfExpired(game, receivedAt, transaction) {
  if (game.status !== "in_progress" || !game.turn_started_at) return false;
  const chess = new Chess(game.current_fen);
  const color = chess.turn();
  const field = remainingField(color);
  const elapsed = receivedAt.getTime() - new Date(game.turn_started_at).getTime();
  const remaining = Number(game[field]);
  if (elapsed < remaining) return false;
  game[field] = 0;
  const insufficient = chess.isInsufficientMaterial();
  const result = insufficient ? "1/2-1/2" : color === "w" ? "0-1" : "1-0";
  await finishGame(game, { result, reason: "timeout", endedAt: receivedAt }, transaction);
  return true;
}

async function createRoom(userId, body) {
  if (!body || body.mode !== "pvp" || body.difficulty !== undefined) {
    fail(400, "INVALID_GAME", "Pembuatan game PvP memerlukan mode pvp dan tidak menerima difficulty.");
  }
  const preset = TIME_CONTROLS[body.time_control];
  if (!preset) fail(400, "INVALID_TIME_CONTROL", "Preset waktu tidak valid.");
  const user = await User.findByPk(userId, { attributes: ["id", "username"] });
  if (!user) fail(401, "ACCOUNT_NOT_FOUND", "Akun tidak ditemukan.");
  const now = new Date();
  const ms = preset.minutes * 60_000;
  const game = await Game.create({
    id: randomUUID(), mode: "pvp", status: "waiting",
    time_control_minutes: preset.minutes, increment_seconds: preset.increment,
    bot_difficulty: null, white_player_id: userId, black_player_id: null,
    current_fen: START_FEN, white_time_remaining_ms: ms, black_time_remaining_ms: ms,
    turn_started_at: null, started_at: null,
  });
  return { game: publicGame(game, "w", null, now), white: user.username, black: null };
}

async function listOpenRooms() {
  const games = await Game.findAll({
    where: { mode: "pvp", status: "waiting", black_player_id: null },
    include: [{ model: User, as: "whitePlayer", attributes: ["username"] }],
    order: [["created_at", "ASC"]], limit: 100,
  });
  return games.map((game) => ({
    id: game.id,
    white: game.whitePlayer.username,
    time_control: Object.keys(TIME_CONTROLS).find((id) => TIME_CONTROLS[id].minutes === game.time_control_minutes),
    createdAt: game.created_at,
  }));
}

async function listLiveGames() {
  const games = await Game.findAll({
    where: { mode: "pvp", status: "in_progress" },
    include: [
      { model: User, as: "whitePlayer", attributes: ["username"] },
      { model: User, as: "blackPlayer", attributes: ["username"] },
      { model: GameMove, as: "moves", attributes: ["id"] },
    ],
    order: [["started_at", "DESC"]], limit: 100,
  });
  const now = new Date();
  return games.map((game) => ({
    id: game.id, white: game.whitePlayer.username, black: game.blackPlayer.username,
    startedAt: game.started_at,
    time_control: {
      id: Object.keys(TIME_CONTROLS).find((id) => TIME_CONTROLS[id].minutes === game.time_control_minutes),
      initial_seconds: game.time_control_minutes * 60,
      increment_seconds: game.increment_seconds,
    },
    clocks: clockSnapshot(game, now), fen: game.current_fen, moveCount: game.moves.length,
  }));
}

async function joinRoom(userId, gameId, receivedAt = new Date()) {
  return enqueueGameAction(gameId, () => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (transaction) => {
    const game = await Game.findByPk(gameId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!game) fail(404, "GAME_NOT_FOUND", "Game tidak ditemukan.");
    if (game.mode !== "pvp" || game.status !== "waiting") fail(409, "ROOM_UNAVAILABLE", "Room sudah tidak tersedia.");
    if (game.white_player_id === userId) fail(409, "CANNOT_JOIN_OWN_ROOM", "Anda tidak dapat bergabung ke room sendiri.");
    game.black_player_id = userId;
    game.status = "in_progress";
    game.started_at = receivedAt;
    game.turn_started_at = new Date();
    await game.save({ transaction });
    const [white, black] = await Promise.all([
      User.findByPk(game.white_player_id, { attributes: ["username"], transaction }),
      User.findByPk(userId, { attributes: ["username"], transaction }),
    ]);
    return { game: publicGame(game, "b", white.username, game.turn_started_at), white: white.username, black: black.username };
  }));
}

async function makeMove(userId, gameId, moveInput, receivedAt = new Date()) {
  if (!moveInput || typeof moveInput.from !== "string" || typeof moveInput.to !== "string" ||
      (moveInput.promotion !== undefined && !["q", "r", "b", "n"].includes(moveInput.promotion))) {
    fail(400, "INVALID_MOVE", "Langkah harus memiliki petak asal dan tujuan yang valid.");
  }
  return enqueueGameAction(gameId, () => sequelize.transaction(async (transaction) => {
    const game = await Game.findByPk(gameId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!game) fail(404, "GAME_NOT_FOUND", "Game tidak ditemukan.");
    if (game.status !== "in_progress") fail(409, "GAME_NOT_ACTIVE", "Game tidak sedang berlangsung.");
    const color = isPlayer(game, userId);
    if (!color) fail(403, "NOT_A_PLAYER", "Hanya pemain dalam game yang dapat mengirim langkah.");
    const chess = new Chess(game.current_fen);
    if (chess.turn() !== color) fail(409, "NOT_YOUR_TURN", "Belum giliran Anda.");
    if (await timeoutIfExpired(game, receivedAt, transaction)) {
      return {
        game: publicGame(game, color, null, receivedAt), gameOver: true, timedOut: true,
        history: await loadHistory(gameId, transaction), pgn: await gamePgn(gameId, game.result, transaction),
        ...await playerNames(game, transaction),
      };
    }
    const history = await loadHistory(gameId, transaction);
    let played;
    try {
      played = chess.move({ from: moveInput.from, to: moveInput.to, promotion: moveInput.promotion });
    } catch {
      fail(400, "ILLEGAL_MOVE", "Langkah catur tidak legal.");
    }
    if (!played) fail(400, "ILLEGAL_MOVE", "Langkah catur tidak legal.");
    const elapsed = Math.max(0, receivedAt.getTime() - new Date(game.turn_started_at).getTime());
    const field = remainingField(color);
    game[field] = Math.max(0, Number(game[field]) - elapsed) + game.increment_seconds * 1000;
    game.current_fen = chess.fen();
    game.turn_started_at = receivedAt;
    game.draw_offer_by_player_id = null;
    const ply = history.length + 1;
    const moveRow = await GameMove.create({
      id: randomUUID(), game_id: gameId, ply, actor_type: "player", player_id: userId,
      color, from_square: played.from, to_square: played.to, promotion: played.promotion || null,
      san: played.san, fen_after: chess.fen(), created_at: receivedAt,
    }, { transaction });
    let gameOver = false;
    if (chess.isCheckmate()) {
      await finishGame(game, { result: color === "w" ? "1-0" : "0-1", reason: "checkmate", endedAt: receivedAt }, transaction);
      gameOver = true;
    } else if (chess.isStalemate()) {
      await finishGame(game, { result: "1/2-1/2", reason: "stalemate", endedAt: receivedAt }, transaction);
      gameOver = true;
    } else if (chess.isInsufficientMaterial()) {
      await finishGame(game, { result: "1/2-1/2", reason: "dead_position", endedAt: receivedAt }, transaction);
      gameOver = true;
    } else if (repetitionCount(history, chess.fen()) + 1 >= 5) {
      await finishGame(game, { result: "1/2-1/2", reason: "fivefold_repetition", endedAt: receivedAt }, transaction);
      gameOver = true;
    } else if (Number(chess.fen().split(" ")[4]) >= 150) {
      await finishGame(game, { result: "1/2-1/2", reason: "seventy_five_move_rule", endedAt: receivedAt }, transaction);
      gameOver = true;
    } else {
      game.turn_started_at = new Date();
    }
    await game.save({ transaction });
    history.push(moveRow);
    const names = await playerNames(game, transaction);
    return {
      game: publicGame(game, color, color === "w" ? names.black : names.white, game.turn_started_at || receivedAt),
      ...names,
      move: { from: played.from, to: played.to, promotion: played.promotion || null, san: played.san, color },
    pgn: buildPgn(history, game.result || "*"), history, gameOver,
    };
  }));
}

async function getGame(userId, gameId) {
  const game = await Game.findByPk(gameId, {
    include: [
      { model: User, as: "whitePlayer", attributes: ["id", "username"] },
      { model: User, as: "blackPlayer", attributes: ["id", "username"] },
    ],
  });
  if (!game) fail(404, "GAME_NOT_FOUND", "Game tidak ditemukan.");
  if (!isPlayer(game, userId)) fail(403, "GAME_FORBIDDEN", "Hanya pemain game yang dapat melihat detail.");
  const history = await loadHistory(gameId);
  return {
    game: publicGame(game, isPlayer(game, userId), game.white_player_id === userId ? game.blackPlayer?.username : game.whitePlayer.username),
    white: game.whitePlayer.username, black: game.blackPlayer?.username || null,
    pgn: buildPgn(history, game.result || "*"),
    history: history.map((item) => ({
      ply: item.ply, color: item.color,
      actor: item.player_id === game.white_player_id ? game.whitePlayer.username : game.blackPlayer?.username,
      from: item.from_square, to: item.to_square, promotion: item.promotion,
      san: item.san, fen_after: item.fen_after,
    })),
  };
}

async function watchGame(userId, gameId) {
  const game = await Game.findByPk(gameId, {
    include: [
      { model: User, as: "whitePlayer", attributes: ["username"] },
      { model: User, as: "blackPlayer", attributes: ["username"] },
    ],
  });
  if (!game) fail(404, "GAME_NOT_FOUND", "Game tidak ditemukan.");
  const color = isPlayer(game, userId);
  if (!(game.mode === "pvp" && game.status === "in_progress") && !color) {
    fail(403, "WATCH_FORBIDDEN", "Anda tidak dapat menonton game ini.");
  }
  const history = await loadHistory(gameId);
  return {
    room_id: game.id, fen: game.current_fen, pgn: buildPgn(history, game.result || "*"),
    white: game.whitePlayer.username, black: game.blackPlayer?.username || null,
    status: game.status, result: game.result, termination_reason: game.termination_reason,
    clocks: clockSnapshot(game),
    time_control: Object.keys(TIME_CONTROLS).find((id) => TIME_CONTROLS[id].minutes === game.time_control_minutes),
    draw_offer_by_player_id: game.draw_offer_by_player_id,
  };
}

async function resign(userId, gameId, receivedAt = new Date()) {
  return enqueueGameAction(gameId, () => sequelize.transaction(async (transaction) => {
    const game = await Game.findByPk(gameId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!game) fail(404, "GAME_NOT_FOUND", "Game tidak ditemukan.");
    const color = isPlayer(game, userId);
    if (!color) fail(403, "NOT_A_PLAYER", "Hanya pemain dalam game yang dapat menyerah.");
    if (game.status !== "in_progress") fail(409, "GAME_NOT_ACTIVE", "Game tidak sedang berlangsung.");
    if (await timeoutIfExpired(game, receivedAt, transaction)) return { game: publicGame(game, color, null, receivedAt), gameOver: true, timedOut: true, pgn: await gamePgn(gameId, game.result, transaction), ...await playerNames(game, transaction) };
    await finishGame(game, { result: color === "w" ? "0-1" : "1-0", reason: "resignation", endedAt: receivedAt }, transaction);
    return { game: publicGame(game, color, null, receivedAt), gameOver: true, pgn: await gamePgn(gameId, game.result, transaction), ...await playerNames(game, transaction) };
  }));
}

async function offerDraw(userId, gameId, receivedAt = new Date()) {
  return enqueueGameAction(gameId, () => sequelize.transaction(async (transaction) => {
    const game = await Game.findByPk(gameId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!game) fail(404, "GAME_NOT_FOUND", "Game tidak ditemukan.");
    const color = isPlayer(game, userId);
    if (!color) fail(403, "NOT_A_PLAYER", "Hanya pemain dalam game yang dapat menawarkan remis.");
    if (game.mode !== "pvp" || game.status !== "in_progress") fail(409, "GAME_NOT_ACTIVE", "Game PvP tidak sedang berlangsung.");
    if (await timeoutIfExpired(game, receivedAt, transaction)) return { game: publicGame(game, color, null, receivedAt), gameOver: true, timedOut: true, pgn: await gamePgn(gameId, game.result, transaction), ...await playerNames(game, transaction) };
    if (new Chess(game.current_fen).turn() !== color) fail(409, "NOT_YOUR_TURN", "Tawaran remis hanya dapat dikirim saat giliran Anda.");
    if (game.draw_offer_by_player_id) fail(409, "DRAW_OFFER_PENDING", "Sudah ada tawaran remis yang menunggu jawaban.");
    const history = await loadHistory(gameId, transaction);
    if (!history.some((move) => move.color === "w") || !history.some((move) => move.color === "b")) {
      fail(409, "DRAW_OFFER_TOO_EARLY", "Kedua pemain harus sudah melangkah sebelum menawarkan remis.");
    }
    game.draw_offer_by_player_id = userId;
    await game.save({ transaction });
    const names = await playerNames(game, transaction);
    return {
      game: publicGame(game, color, null, receivedAt), offered_by: userId,
      offered_by_username: names[color === "w" ? "white" : "black"], ...names,
    };
  }));
}

async function respondDraw(userId, gameId, decision, receivedAt = new Date()) {
  if (!["accept", "decline"].includes(decision)) fail(400, "INVALID_DECISION", "decision harus accept atau decline.");
  return enqueueGameAction(gameId, () => sequelize.transaction(async (transaction) => {
    const game = await Game.findByPk(gameId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!game) fail(404, "GAME_NOT_FOUND", "Game tidak ditemukan.");
    const color = isPlayer(game, userId);
    if (!color) fail(403, "NOT_A_PLAYER", "Hanya pemain dalam game yang dapat menjawab tawaran remis.");
    if (game.status !== "in_progress" || game.mode !== "pvp") fail(409, "GAME_NOT_ACTIVE", "Game PvP tidak sedang berlangsung.");
    if (await timeoutIfExpired(game, receivedAt, transaction)) return { game: publicGame(game, color, null, receivedAt), gameOver: true, timedOut: true, pgn: await gamePgn(gameId, game.result, transaction), ...await playerNames(game, transaction) };
    if (!game.draw_offer_by_player_id || game.draw_offer_by_player_id === userId) fail(409, "NO_DRAW_OFFER", "Tidak ada tawaran remis dari lawan.");
    if (decision === "accept") {
      await finishGame(game, { result: "1/2-1/2", reason: "draw_agreement", endedAt: receivedAt }, transaction);
    } else {
      game.draw_offer_by_player_id = null;
      await game.save({ transaction });
    }
    return { game: publicGame(game, color, null, receivedAt), gameOver: decision === "accept", decision, pgn: decision === "accept" ? await gamePgn(gameId, game.result, transaction) : undefined, ...await playerNames(game, transaction) };
  }));
}

async function claimDraw(userId, gameId, reason, receivedAt = new Date()) {
  if (!["threefold_repetition", "fifty_move_rule"].includes(reason)) fail(400, "INVALID_DRAW_CLAIM", "Alasan klaim remis tidak valid.");
  return enqueueGameAction(gameId, () => sequelize.transaction(async (transaction) => {
    const game = await Game.findByPk(gameId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!game) fail(404, "GAME_NOT_FOUND", "Game tidak ditemukan.");
    const color = isPlayer(game, userId);
    if (!color) fail(403, "NOT_A_PLAYER", "Hanya pemain dalam game yang dapat mengklaim remis.");
    if (game.status !== "in_progress") fail(409, "GAME_NOT_ACTIVE", "Game tidak sedang berlangsung.");
    if (await timeoutIfExpired(game, receivedAt, transaction)) return { game: publicGame(game, color, null, receivedAt), gameOver: true, timedOut: true, pgn: await gamePgn(gameId, game.result, transaction), ...await playerNames(game, transaction) };
    const chess = new Chess(game.current_fen);
    if (chess.turn() !== color) fail(409, "NOT_YOUR_TURN", "Klaim remis hanya dapat diajukan saat giliran Anda.");
    const history = await loadHistory(gameId, transaction);
    const valid = reason === "threefold_repetition"
      ? repetitionCount(history, game.current_fen) >= 3
      : Number(game.current_fen.split(" ")[4]) >= 100;
    if (valid) {
      await finishGame(game, { result: "1/2-1/2", reason, endedAt: receivedAt }, transaction);
    } else {
      const opponentField = remainingField(opponentColor(color));
      game[opponentField] = Number(game[opponentField]) + 120_000;
      await game.save({ transaction });
    }
    return { game: publicGame(game, color, null, receivedAt), gameOver: valid, claimAccepted: valid, pgn: valid ? await gamePgn(gameId, game.result, transaction) : undefined, ...await playerNames(game, transaction) };
  }));
}

async function expireGame(gameId, now = new Date()) {
  return enqueueGameAction(gameId, () => sequelize.transaction(async (transaction) => {
    const game = await Game.findByPk(gameId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!game || game.status !== "in_progress") return null;
    const chess = new Chess(game.current_fen);
    const deadline = new Date(game.turn_started_at).getTime() + Number(game[remainingField(chess.turn())]);
    if (now.getTime() < deadline) return null;
    await timeoutIfExpired(game, new Date(deadline), transaction);
    const pgn = await gamePgn(gameId, game.result, transaction);
    const [white, black] = await Promise.all([
      User.findByPk(game.white_player_id, { attributes: ["username"], transaction }),
      User.findByPk(game.black_player_id, { attributes: ["username"], transaction }),
    ]);
    return {
      game: publicGame(game, null, null, new Date(deadline)), gameOver: true,
      white: white?.username, black: black?.username, pgn,
    };
  }));
}

async function findActiveGameIds() {
  const games = await Game.findAll({ where: { status: "in_progress" }, attributes: ["id"] });
  return games.map(({ id }) => id);
}

module.exports = {
  GameError, TIME_CONTROLS, createRoom, listOpenRooms, listLiveGames, joinRoom,
  makeMove, getGame, watchGame, resign, expireGame, findActiveGameIds,
  offerDraw, respondDraw, claimDraw,
};
