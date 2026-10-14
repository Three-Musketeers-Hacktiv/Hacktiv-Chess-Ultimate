process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "history-test-secret-that-is-not-for-production";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const http = require("node:http");
const { Op } = require("sequelize");
const { Chess } = require("chess.js");
const { Game, GameMove, User, sequelize } = require("../src/models");
const { signToken } = require("../src/helpers/jwt");
const app = require("../src/app");

let server;
let baseUrl;
let owner;
let opponent;
let outsider;
const gameIds = [];

async function createGame({ mode, status, white, black = null, difficulty = null, createdAt, result = null, reason = null }) {
  const id = randomUUID();
  gameIds.push(id);
  const active = status === "in_progress";
  const startedAt = status === "waiting" ? null : createdAt;
  const endedAt = status === "completed" ? new Date(createdAt.getTime() + 1000) : null;
  return Game.create({
    id, mode, status, time_control_minutes: 3, increment_seconds: 2,
    bot_difficulty: difficulty, white_player_id: white.id, black_player_id: black?.id || null,
    current_fen: new Chess().fen(), white_time_remaining_ms: 180000, black_time_remaining_ms: 180000,
    turn_started_at: active ? createdAt : null, result, termination_reason: reason,
    created_at: createdAt, started_at: startedAt, ended_at: endedAt,
  });
}

async function addMove(game, { ply, actorType, player, color, from, to, san }) {
  await GameMove.create({
    id: randomUUID(), game_id: game.id, ply, actor_type: actorType,
    player_id: player?.id || null, color, from_square: from, to_square: to,
    promotion: null, san, fen_after: new Chess().fen(), created_at: game.created_at,
  });
}

async function setup() {
  await sequelize.authenticate();
  const suffix = Date.now();
  owner = await User.create({ username: `hown_${suffix}`, email: `history_owner_${suffix}@example.com`, password_hash: "temporary-test-only" });
  opponent = await User.create({ username: `hopp_${suffix}`, email: `history_opponent_${suffix}@example.com`, password_hash: "temporary-test-only" });
  outsider = await User.create({ username: `hout_${suffix}`, email: `history_outsider_${suffix}@example.com`, password_hash: "temporary-test-only" });
  const stamp = Date.now();
  const newest = await createGame({
    mode: "bot", status: "completed", white: owner, difficulty: "medium",
    createdAt: new Date(stamp + 3000), result: "1/2-1/2", reason: "engine_failure",
  });
  await addMove(newest, { ply: 1, actorType: "player", player: owner, color: "w", from: "e2", to: "e4", san: "e4" });
  await addMove(newest, { ply: 2, actorType: "bot", color: "b", from: "e7", to: "e5", san: "e5" });

  const middle = await createGame({
    mode: "pvp", status: "completed", white: opponent, black: owner,
    createdAt: new Date(stamp + 2000), result: "1-0", reason: "checkmate",
  });
  await addMove(middle, { ply: 1, actorType: "player", player: opponent, color: "w", from: "e2", to: "e4", san: "e4" });

  await createGame({ mode: "pvp", status: "waiting", white: owner, createdAt: new Date(stamp + 1000) });
  await createGame({
    mode: "pvp", status: "completed", white: outsider, black: opponent,
    createdAt: new Date(stamp), result: "0-1", reason: "resignation",
  });

  server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function cleanup() {
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (gameIds.length) {
    await GameMove.destroy({ where: { game_id: { [Op.in]: gameIds } } });
    await Game.destroy({ where: { id: { [Op.in]: gameIds } } });
  }
  const userIds = [owner?.id, opponent?.id, outsider?.id].filter(Boolean);
  if (userIds.length) await User.destroy({ where: { id: { [Op.in]: userIds } } });
  await sequelize.close();
}

before(setup);
after(cleanup);

function authHeaders(userId) {
  return { Authorization: `Bearer ${signToken({ sub: userId })}` };
}

test("game history is private, cursor-paginated, and includes PvP and bot summaries", async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/games`);
  assert.equal(unauthenticated.status, 401);

  const firstResponse = await fetch(`${baseUrl}/api/games?limit=2`, { headers: authHeaders(owner.id) });
  assert.equal(firstResponse.status, 200);
  const first = await firstResponse.json();
  assert.equal(first.games.length, 2);
  assert.equal(first.pagination.has_more, true);
  assert.ok(first.pagination.next_cursor);
  assert.deepEqual(first.games.map((game) => game.mode), ["bot", "pvp"]);
  assert.deepEqual(first.games.map((game) => game.color), ["w", "b"]);
  assert.equal(first.games[0].opponent, "Stockfish (medium)");
  assert.equal(first.games[0].move_count, 2);
  assert.equal(first.games[0].termination_reason, "engine_failure");
  assert.equal(first.games[1].opponent, opponent.username);
  assert.equal(first.games[1].move_count, 1);

  const secondResponse = await fetch(`${baseUrl}/api/games?limit=2&cursor=${encodeURIComponent(first.pagination.next_cursor)}`, {
    headers: authHeaders(owner.id),
  });
  assert.equal(secondResponse.status, 200);
  const second = await secondResponse.json();
  assert.equal(second.games.length, 1);
  assert.equal(second.games[0].status, "waiting");
  assert.equal(second.games[0].opponent, null);
  assert.equal(second.pagination.has_more, false);
  assert.equal(second.pagination.next_cursor, null);
});

test("game history rejects invalid pagination input", async () => {
  const invalidLimit = await fetch(`${baseUrl}/api/games?limit=51`, { headers: authHeaders(owner.id) });
  assert.equal(invalidLimit.status, 400);
  assert.equal((await invalidLimit.json()).code, "INVALID_HISTORY_LIMIT");

  const invalidCursor = await fetch(`${baseUrl}/api/games?cursor=not-a-cursor`, { headers: authHeaders(owner.id) });
  assert.equal(invalidCursor.status, 400);
  assert.equal((await invalidCursor.json()).code, "INVALID_HISTORY_CURSOR");
});

test("game history never includes another user's games", async () => {
  const response = await fetch(`${baseUrl}/api/games?limit=50`, { headers: authHeaders(owner.id) });
  const body = await response.json();
  assert.equal(body.games.length, 3);
  assert.ok(body.games.every((game) => game.opponent !== outsider.username));
});
