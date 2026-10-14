process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "analysis-test-secret-that-is-not-for-production";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const { randomUUID } = require("node:crypto");
const http = require("node:http");
const { Op } = require("sequelize");
const { Chess } = require("chess.js");
const { Game, GameMove, User, sequelize } = require("../src/models");
const stockfish = require("../src/services/stockfish.service");
const { signToken } = require("../src/helpers/jwt");
const app = require("../src/app");

let server;
let baseUrl;
let owner;
let opponent;
let outsider;
let completedGame;
let activeGame;
let longGame;
const gameIds = [];
const originalReserveAnalysis = stockfish.reserveAnalysis;
let analysisReservations = 0;

async function createGame({ status, white, black, moves = [], id = randomUUID() }) {
  const chess = new Chess();
  const rows = [];
  for (let index = 0; index < moves.length; index += 1) {
    const { from, to, promotion, actor } = moves[index];
    const move = chess.move({ from, to, promotion });
    assert.ok(move, `invalid fixture move ${from}-${to}`);
    rows.push({
      id: randomUUID(), game_id: id, ply: index + 1,
      actor_type: "player", player_id: actor.id, color: move.color,
      from_square: move.from, to_square: move.to, promotion: move.promotion || null,
      san: move.san, fen_after: chess.fen(), created_at: new Date(),
    });
  }
  gameIds.push(id);
  const now = new Date();
  const game = await Game.create({
    id, mode: "pvp", status, time_control_minutes: 3, increment_seconds: 2,
    bot_difficulty: null, white_player_id: white.id, black_player_id: black.id,
    current_fen: chess.fen(), white_time_remaining_ms: 180000, black_time_remaining_ms: 180000,
    turn_started_at: status === "in_progress" ? now : null, result: status === "completed" ? "1/2-1/2" : null,
    termination_reason: status === "completed" ? "draw_agreement" : null,
    created_at: now, started_at: now, ended_at: status === "completed" ? now : null,
  });
  if (rows.length) await GameMove.bulkCreate(rows);
  return game;
}

before(async () => {
  await sequelize.authenticate();
  const suffix = Date.now();
  owner = await User.create({ username: `an_owner_${suffix}`, email: `analysis_owner_${suffix}@example.com`, password_hash: "temporary-test-only" });
  opponent = await User.create({ username: `an_opp_${suffix}`, email: `analysis_opponent_${suffix}@example.com`, password_hash: "temporary-test-only" });
  outsider = await User.create({ username: `an_out_${suffix}`, email: `analysis_outsider_${suffix}@example.com`, password_hash: "temporary-test-only" });

  completedGame = await createGame({
    status: "completed", white: owner, black: opponent,
    moves: [
      { from: "e2", to: "e4", actor: owner },
      { from: "e7", to: "e5", actor: opponent },
    ],
  });
  activeGame = await createGame({ status: "in_progress", white: owner, black: opponent });

  const loop = [
    ["g1", "f3", owner], ["g8", "f6", opponent],
    ["f3", "g1", owner], ["f6", "g8", opponent],
  ];
  longGame = await createGame({
    status: "completed", white: owner, black: opponent,
    moves: Array.from({ length: 61 }, (_, index) => {
      const [from, to, actor] = loop[index % loop.length];
      return { from, to, actor };
    }),
  });

  stockfish.reserveAnalysis = () => {
    analysisReservations += 1;
    return {
      run: async (fens) => [
        { score: { cp: 150, mate: null }, best_move: "g1f3" },
        { score: { cp: 10, mate: null }, best_move: "e7e5" },
        { score: { cp: 30, mate: null }, best_move: null },
      ].slice(0, fens.length),
      release() {},
    };
  };

  server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  stockfish.reserveAnalysis = originalReserveAnalysis;
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (gameIds.length) {
    await GameMove.destroy({ where: { game_id: { [Op.in]: gameIds } } });
    await Game.destroy({ where: { id: { [Op.in]: gameIds } } });
  }
  const userIds = [owner?.id, opponent?.id, outsider?.id].filter(Boolean);
  if (userIds.length) await User.destroy({ where: { id: { [Op.in]: userIds } } });
  await sequelize.close();
});

test("analysis uses a completed player's saved moves and returns per-move evaluations", async () => {
  const before = analysisReservations;
  const response = await fetch(`${baseUrl}/api/games/${completedGame.id}/analysis`, {
    method: "POST",
    headers: { authorization: `Bearer ${signToken({ sub: owner.id })}` },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.game_id, completedGame.id);
  assert.equal(body.analyzed_plies, 2);
  assert.deepEqual(body.analysis.map(({ ply, move, label, best_alternative }) => ({ ply, move, label, best_alternative })), [
    { ply: 1, move: "e4", label: "Mistake", best_alternative: "Nf3" },
    { ply: 2, move: "e5", label: "Best Move", best_alternative: null },
  ]);
  assert.deepEqual(body.analysis[0].evaluation, { cp: 10, mate: null });
  assert.equal(analysisReservations, before + 1);
});

test("analysis requires a player on a completed game and enforces the move limit", async () => {
  const headers = { authorization: `Bearer ${signToken({ sub: outsider.id })}` };
  const forbidden = await fetch(`${baseUrl}/api/games/${completedGame.id}/analysis`, { method: "POST", headers });
  assert.equal(forbidden.status, 403);

  const ownerHeaders = { authorization: `Bearer ${signToken({ sub: owner.id })}` };
  const active = await fetch(`${baseUrl}/api/games/${activeGame.id}/analysis`, { method: "POST", headers: ownerHeaders });
  assert.equal(active.status, 409);

  const tooLong = await fetch(`${baseUrl}/api/games/${longGame.id}/analysis`, { method: "POST", headers: ownerHeaders });
  assert.equal(tooLong.status, 422);
  assert.equal((await tooLong.json()).code, "ANALYSIS_GAME_TOO_LONG");
});

test("analysis endpoint requires authentication", async () => {
  const response = await fetch(`${baseUrl}/api/games/${completedGame.id}/analysis`, { method: "POST" });
  assert.equal(response.status, 401);
});
