process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "profile-test-secret-that-is-not-for-production";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const http = require("node:http");
const { Chess } = require("chess.js");
const { Game, GameMove, User, sequelize } = require("../src/models");
const { signToken } = require("../src/helpers/jwt");
const app = require("../src/app");

let server;
let baseUrl;
let owner;
let opponent;
let outsider;
let outsiderGameId;
let winGameId;
const gameIds = [];

async function createGame({ mode = "pvp", status = "completed", white, black, difficulty = null, createdAt, result, reason }) {
  const id = randomUUID();
  gameIds.push(id);
  const active = status === "in_progress";
  return Game.create({
    id, mode, status, time_control_minutes: 3, increment_seconds: 2,
    bot_difficulty: difficulty, white_player_id: white.id, black_player_id: black ? black.id : null,
    current_fen: new Chess().fen(), white_time_remaining_ms: 180000, black_time_remaining_ms: 180000,
    turn_started_at: active ? createdAt : null, result, termination_reason: reason,
    created_at: createdAt, started_at: status === "waiting" ? null : createdAt,
    ended_at: status === "completed" ? new Date(createdAt.getTime() + 1000) : null,
  });
}

async function addMoves(game, notation, white, black) {
  const chess = new Chess();
  for (const san of notation) {
    const move = chess.move(san);
    await GameMove.create({
      id: randomUUID(), game_id: game.id, ply: chess.history().length, actor_type: "player",
      player_id: move.color === "w" ? white.id : black.id, color: move.color,
      from_square: move.from, to_square: move.to, promotion: move.promotion || null,
      san: move.san, fen_after: chess.fen(), created_at: game.created_at,
    });
  }
}

async function setup() {
  await sequelize.authenticate();
  const suffix = Date.now();
  owner = await User.create({ username: "prof_" + suffix, email: "profile_owner_" + suffix + "@example.com", password_hash: "temporary-test-only" });
  opponent = await User.create({ username: "oppo_" + suffix, email: "profile_opponent_" + suffix + "@example.com", password_hash: "temporary-test-only" });
  outsider = await User.create({ username: "outs_" + suffix, email: "profile_outsider_" + suffix + "@example.com", password_hash: "temporary-test-only" });
  const stamp = Date.now();

  const extraGames = Array.from({ length: 48 }, (_, index) => {
    const createdAt = new Date(stamp + 10_000 + index * 1000);
    const id = randomUUID();
    gameIds.push(id);
    return {
      id, mode: "pvp", status: "completed", time_control_minutes: 3, increment_seconds: 2,
      bot_difficulty: null, white_player_id: owner.id, black_player_id: opponent.id,
      current_fen: new Chess().fen(), white_time_remaining_ms: 180000, black_time_remaining_ms: 180000,
      turn_started_at: null, result: "0-1", termination_reason: "resignation",
      created_at: createdAt, started_at: createdAt, ended_at: new Date(createdAt.getTime() + 1000),
    };
  });
  await Game.bulkCreate(extraGames);

  const win = await createGame({
    white: owner, black: opponent, createdAt: new Date(stamp + 60_000), result: "1-0", reason: "checkmate",
  });
  winGameId = win.id;
  await addMoves(win, ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"], owner, opponent);
  await createGame({
    mode: "bot", white: owner, difficulty: "easy", createdAt: new Date(stamp + 59_000),
    result: "1/2-1/2", reason: "draw_agreement",
  });
  await createGame({
    white: opponent, black: owner, createdAt: new Date(stamp + 58_000), result: "1-0", reason: "resignation",
  });
  await createGame({
    white: owner, black: opponent, status: "in_progress", createdAt: new Date(stamp + 70_000),
  });
  const outsiderGame = await createGame({
    white: outsider, black: opponent, createdAt: new Date(stamp + 80_000), result: "1-0", reason: "checkmate",
  });
  outsiderGameId = outsiderGame.id;

  server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = "http://127.0.0.1:" + server.address().port;
}

async function cleanup() {
  if (server && server.listening) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (gameIds.length) {
    await GameMove.destroy({ where: { game_id: gameIds } });
    await Game.destroy({ where: { id: gameIds } });
  }
  const userIds = [owner && owner.id, opponent && opponent.id, outsider && outsider.id].filter(Boolean);
  if (userIds.length) await User.destroy({ where: { id: userIds } });
  await sequelize.close();
}

before(setup);
after(cleanup);

function authHeaders(userId) {
  return { Authorization: "Bearer " + signToken({ sub: userId }) };
}

test("profile is authenticated, private, summarizes completed games, and includes up to 50 PGNs", async () => {
  const unauthenticated = await fetch(baseUrl + "/api/profile/me");
  assert.equal(unauthenticated.status, 401);

  const response = await fetch(baseUrl + "/api/profile/me?user_id=" + outsider.id, {
    headers: authHeaders(owner.id),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.profile.id, owner.id);
  assert.equal(body.profile.username, owner.username);
  assert.deepEqual(body.profile.stats, { wins: 1, draws: 1, losses: 49, total_games: 51 });
  assert.equal(body.profile.games.length, 50);
  assert.ok(body.profile.games.every((game) => game.id !== outsiderGameId));

  const botGame = body.profile.games.find((game) => game.mode === "bot");
  assert.equal(botGame.opponent, "Stockfish (easy)");
  assert.equal(botGame.result, "1/2-1/2");

  const winGame = body.profile.games.find((game) => game.id === winGameId);
  assert.ok(winGame);
  assert.match(winGame.pgn, /Qxf7#/);
  assert.ok(winGame.pgn.includes("[White \"" + owner.username + "\"]"));
  assert.ok(winGame.pgn.includes("[Black \"" + opponent.username + "\"]"));
});
