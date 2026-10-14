process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "ranked-test-secret-that-is-not-for-production";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const http = require("node:http");
const { Op } = require("sequelize");
const { Game, GameMove, User, sequelize } = require("../src/models");
const { signToken } = require("../src/helpers/jwt");
const gameService = require("../src/services/game.service");
const app = require("../src/app");
const registerGameSocket = require("../src/socket/game.socket");

const TIME_CONTROL = "10+0";
let server;
let baseUrl;
let alice;
let bob;
let carol;
let dave;
const gameIds = new Set();
const emitted = [];

const authHeaders = (user) => ({ Authorization: `Bearer ${signToken({ sub: user.id })}`, "Content-Type": "application/json" });
const track = (...games) => games.forEach((game) => game?.id && gameIds.add(game.id));
const eloOf = async (user) => (await User.findByPk(user.id, { attributes: ["elo_rating"] })).elo_rating;

/** Minimal Socket.IO stand-in: `io.to(room).emit(...)` is recorded, sockets expose their handlers. */
function createFakeIo() {
  let onConnection;
  const io = {
    on: (event, handler) => { if (event === "connection") onConnection = handler; },
    to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
  };
  io.connect = (user) => {
    const handlers = {};
    const own = [];
    const socket = {
      data: { user: { id: user.id } },
      join: async () => {}, leave: async () => {},
      on: (event, handler) => { handlers[event] = handler; },
      emit: (event, payload) => own.push({ event, payload }),
    };
    onConnection(socket);
    return { own, send: (event, payload) => handlers[event](payload) };
  };
  return io;
}

async function createUser(prefix, elo = 1500) {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  return User.create({
    username: `${prefix}_${suffix}`.slice(0, 24), email: `ranked_${prefix}_${suffix}@example.com`,
    password_hash: "temporary-test-only", elo_rating: elo,
  });
}

before(async () => {
  await sequelize.authenticate();
  alice = await createUser("alice", 1500);
  bob = await createUser("bob", 1500);
  carol = await createUser("carol", 2400);
  dave = await createUser("dave", 1500);
  server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  const ids = [...gameIds];
  if (ids.length) {
    await GameMove.destroy({ where: { game_id: { [Op.in]: ids } } });
    await Game.destroy({ where: { id: { [Op.in]: ids } } });
  }
  await User.destroy({ where: { id: { [Op.in]: [alice, bob, carol, dave].filter(Boolean).map((user) => user.id) } } });
  await sequelize.close();
});

test("new users start at 1500 Elo and GET / advertises ranked + rematch", async () => {
  assert.equal(await eloOf(dave), 1500);
  const response = await fetch(`${baseUrl}/`, { headers: authHeaders(dave) });
  assert.equal(response.status, 200);
  const { home } = await response.json();
  assert.equal(home.user.elo_rating, 1500);
  assert.equal(home.capabilities.ranked, "available");
  assert.equal(home.capabilities.rematch, "available");
  assert.equal(home.game_modes.find((mode) => mode.id === "ranked").status, "available");
});

test("POST /api/matchmaking/join validates mode and requires a token", async () => {
  const anonymous = await fetch(`${baseUrl}/api/matchmaking/join`, { method: "POST" });
  assert.equal(anonymous.status, 401);
  const invalid = await fetch(`${baseUrl}/api/matchmaking/join`, {
    method: "POST", headers: authHeaders(dave), body: JSON.stringify({ mode: "bogus", time_control: TIME_CONTROL }),
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, "INVALID_MATCHMAKING_MODE");
});

let rankedGame;

test("ranked matchmaking only pairs players within ±200 Elo and keeps ranked and casual queues apart", async () => {
  const queued = await gameService.joinMatchmaking(alice.id, { mode: "ranked", time_control: TIME_CONTROL });
  track(queued.game);
  assert.equal(queued.matched, false);
  assert.equal(queued.game.ranked, true);
  assert.equal(queued.game.elo.white.before, 1500);

  // Same ranked queue again is idempotent; another mode or clock is a conflict.
  const again = await gameService.joinMatchmaking(alice.id, { mode: "ranked", time_control: TIME_CONTROL });
  assert.equal(again.game.id, queued.game.id);
  await assert.rejects(gameService.joinMatchmaking(alice.id, { mode: "casual", time_control: TIME_CONTROL }), { code: "MATCHMAKING_ALREADY_QUEUED" });

  // A 2400 player is out of range and queues on their own room.
  const outOfRange = await gameService.joinMatchmaking(carol.id, { mode: "ranked", time_control: TIME_CONTROL });
  track(outOfRange.game);
  assert.equal(outOfRange.matched, false);
  assert.notEqual(outOfRange.game.id, queued.game.id);
  await gameService.cancelMatchmaking(carol.id, outOfRange.game.id);

  // A casual player never takes the ranked room.
  const casual = await gameService.joinMatchmaking(dave.id, { mode: "casual", time_control: TIME_CONTROL });
  track(casual.game);
  assert.equal(casual.matched, false);
  assert.equal(casual.game.ranked, false);
  await gameService.cancelMatchmaking(dave.id, casual.game.id);

  // A similar-Elo ranked player is matched.
  const matched = await gameService.joinMatchmaking(bob.id, { mode: "ranked", time_control: TIME_CONTROL });
  assert.equal(matched.matched, true);
  assert.equal(matched.game.id, queued.game.id);
  assert.equal(matched.game.ranked, true);
  assert.deepEqual([matched.game.elo.white.before, matched.game.elo.black.before], [1500, 1500]);
  assert.equal(matched.game.elo.white.change, null);
  rankedGame = matched.game;
});

test("a finished ranked game books ±ΔElo on both players, the game row and the result payload", async () => {
  // Alice (white) resigns: Bob wins; equal ratings → ±16.
  const result = await gameService.resign(alice.id, rankedGame.id);
  assert.equal(result.game.status, "completed");
  assert.equal(result.game.result, "0-1");
  assert.deepEqual(result.game.elo.white, { before: 1500, change: -16, after: 1484 });
  assert.deepEqual(result.game.elo.black, { before: 1500, change: 16, after: 1516 });
  assert.equal(await eloOf(alice), 1484);
  assert.equal(await eloOf(bob), 1516);

  const stored = await Game.findByPk(rankedGame.id);
  assert.equal(stored.white_elo_change, -16);
  assert.equal(stored.black_elo_change, 16);

  // The same payload is what REST clients and `watch_game` see afterwards.
  const response = await fetch(`${baseUrl}/api/games/${rankedGame.id}`, { headers: authHeaders(alice) });
  assert.deepEqual((await response.json()).game.elo.black, { before: 1500, change: 16, after: 1516 });
  const profile = await fetch(`${baseUrl}/api/profile/me`, { headers: authHeaders(alice) });
  assert.equal((await profile.json()).profile.elo_rating, 1484);
});

test("casual games never touch ratings", async () => {
  const queued = await gameService.joinMatchmaking(dave.id, { mode: "casual", time_control: TIME_CONTROL });
  const matched = await gameService.joinMatchmaking(alice.id, { mode: "casual", time_control: TIME_CONTROL });
  track(queued.game, matched.game);
  assert.equal(matched.matched, true);
  assert.equal(matched.game.elo, null);
  const result = await gameService.resign(dave.id, queued.game.id);
  assert.equal(result.game.elo, null);
  assert.equal(await eloOf(alice), 1484);
  assert.equal(await eloOf(dave), 1500);
});

test("rematch: first request is pending, the opponent's request swaps colours and opens a new room", async () => {
  const io = createFakeIo();
  registerGameSocket(io);
  emitted.length = 0;
  const aliceSocket = io.connect(alice);
  const bobSocket = io.connect(bob);

  await aliceSocket.send("request_rematch", { room_id: rankedGame.id });
  assert.deepEqual(emitted.map(({ room, event }) => [room, event]), [
    [`user:${alice.id}`, "rematch_requested"],
    [`user:${bob.id}`, "rematch_pending"],
  ]);
  assert.equal(emitted[1].payload.room_id, rankedGame.id);
  assert.equal(emitted[1].payload.requested_by, alice.username);

  // A repeated request neither re-notifies the opponent nor starts anything.
  emitted.length = 0;
  await aliceSocket.send("request_rematch", { room_id: rankedGame.id });
  assert.deepEqual(emitted.map(({ event }) => event), ["rematch_requested"]);

  emitted.length = 0;
  await bobSocket.send("request_rematch", { room_id: rankedGame.id });
  assert.deepEqual(emitted.map(({ room, event }) => [room, event]), [
    [`user:${alice.id}`, "rematch_started"],
    [`user:${bob.id}`, "rematch_started"],
  ]);
  const [forAlice, forBob] = emitted.map(({ payload }) => payload);
  track({ id: forAlice.room_id });
  assert.notEqual(forAlice.room_id, rankedGame.id);
  assert.equal(forAlice.room_id, forBob.room_id);
  assert.equal(forAlice.previous_room_id, rankedGame.id);
  assert.equal(forAlice.color, "b"); // Alice was white, now black
  assert.equal(forBob.color, "w");
  assert.equal(forAlice.opponent, bob.username);
  assert.equal(forAlice.game.status, "in_progress");
  assert.equal(forAlice.game.ranked, true);
  assert.equal(forAlice.game.fen, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.deepEqual(forAlice.game.clocks, forBob.game.clocks);
  // Fresh ratings after the first game are the new baseline.
  assert.deepEqual([forBob.game.elo.white.before, forBob.game.elo.black.before], [1516, 1484]);

  const created = await Game.findByPk(forAlice.room_id);
  assert.equal(created.white_player_id, bob.id);
  assert.equal(created.black_player_id, alice.id);

  // The handshake is spent.
  emitted.length = 0;
  await bobSocket.send("request_rematch", { room_id: rankedGame.id });
  assert.equal(bobSocket.own.at(-1).event, "rematch_error");
  assert.equal(bobSocket.own.at(-1).payload.code, "REMATCH_ALREADY_STARTED");
  assert.equal(emitted.length, 0);

  // A running game cannot be rematched, and neither can a game by outsiders.
  await bobSocket.send("request_rematch", { room_id: forAlice.room_id });
  assert.equal(bobSocket.own.at(-1).payload.code, "GAME_NOT_COMPLETED");
  const carolSocket = io.connect(carol);
  await carolSocket.send("request_rematch", { room_id: rankedGame.id });
  assert.equal(carolSocket.own.at(-1).payload.code, "NOT_A_PLAYER");
  await carolSocket.send("request_rematch", {});
  assert.equal(carolSocket.own.at(-1).payload.code, "INVALID_ROOM_ID");

  // Finish the rematch: the swapped colours decide who gains (Bob, white, resigns → Alice wins).
  const rematchResult = await gameService.resign(bob.id, forAlice.room_id);
  assert.equal(rematchResult.game.result, "0-1");
  assert.equal(rematchResult.game.elo.white.change + rematchResult.game.elo.black.change, 0);
  assert.ok(rematchResult.game.elo.black.change > 0);
  assert.equal(await eloOf(alice), 1484 + rematchResult.game.elo.black.change);
});

test("a pending rematch can be declined, which tells the challenger", async () => {
  const lastRanked = await Game.findOne({
    where: { white_player_id: bob.id, black_player_id: alice.id, status: "completed" }, order: [["created_at", "DESC"]],
  });
  const io = createFakeIo();
  registerGameSocket(io);
  emitted.length = 0;
  const aliceSocket = io.connect(alice);
  const bobSocket = io.connect(bob);
  await aliceSocket.send("request_rematch", { room_id: lastRanked.id });
  await bobSocket.send("decline_rematch", { room_id: lastRanked.id });
  const declined = emitted.find(({ event }) => event === "rematch_declined");
  assert.equal(declined.room, `user:${alice.id}`);
  assert.equal(declined.payload.declined_by, bob.username);

  // After a decline the challenge is gone: Bob asking now is a fresh first request.
  emitted.length = 0;
  await bobSocket.send("request_rematch", { room_id: lastRanked.id });
  assert.deepEqual(emitted.map(({ room, event }) => [room, event]), [
    [`user:${bob.id}`, "rematch_requested"],
    [`user:${alice.id}`, "rematch_pending"],
  ]);

  // The challenger may withdraw (e.g. left the arena): the opponent is told, nothing starts afterwards.
  emitted.length = 0;
  await bobSocket.send("decline_rematch", { room_id: lastRanked.id });
  assert.deepEqual(emitted.map(({ room, event }) => [room, event]), [[`user:${alice.id}`, "rematch_declined"]]);
  emitted.length = 0;
  await aliceSocket.send("decline_rematch", { room_id: lastRanked.id }); // nothing pending: silent no-op
  assert.equal(emitted.length, 0);
});

test("rematch of an unknown game is rejected", async () => {
  await assert.rejects(gameService.getRematchContext(alice.id, "00000000-0000-4000-8000-000000000000"), { code: "GAME_NOT_FOUND" });
});
