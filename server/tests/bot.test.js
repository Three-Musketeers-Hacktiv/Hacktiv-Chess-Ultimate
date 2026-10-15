process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { once } = require("node:events");
const http = require("node:http");
const { Game, GameMove, User, sequelize } = require("../src/models");
const gameService = require("../src/services/game.service");
const stockfish = require("../src/services/stockfish.service");
const { signToken } = require("../src/helpers/jwt");
const app = require("../src/app");

const suffix = Date.now();
const email = `bot-${suffix}@example.com`;
const username = `bot_${suffix}`;
let user;
let server;
let baseUrl;
let emittedEvents = [];
const originalIsAvailable = stockfish.isAvailable;
const originalReserve = stockfish.reserveBotMove;

before(async () => {
  await sequelize.authenticate();
  stockfish.isAvailable = () => true;
  stockfish.reserveBotMove = () => ({ run: async () => "e7e5", release() {} });
  user = await User.create({ username, email, password_hash: "test-password" });
  app.set("io", { to: (room) => ({ emit: (event, data) => emittedEvents.push({ room, event, data }) }) });
  server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  stockfish.isAvailable = originalIsAvailable;
  stockfish.reserveBotMove = originalReserve;
  if (user) {
    await Game.destroy({ where: { white_player_id: user.id } });
    await User.destroy({ where: { id: user.id } });
  }
  if (server?.listening) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await sequelize.close();
});

test("bot game persists the player's move and a legal Stockfish move", async () => {
  const created = await gameService.createRoom(user.id, {
    mode: "bot", time_control: "blitz", difficulty: "medium",
  });
  assert.equal(created.game.mode, "bot");
  assert.equal(created.game.color, "w");
  assert.equal(created.game.bot_difficulty, "medium");

  const playerMove = await gameService.makeMove(user.id, created.game.id, { from: "e2", to: "e4" });
  assert.equal(playerMove.botMovePending, true);
  assert.equal(playerMove.move.san, "e4");

  const botMove = await gameService.playBotMove(created.game.id, playerMove.botReservation);
  assert.equal(botMove.move.san, "e5");
  assert.equal(botMove.move.color, "b");

  const savedMoves = await GameMove.findAll({
    where: { game_id: created.game.id }, order: [["ply", "ASC"]],
  });
  assert.deepEqual(savedMoves.map((move) => [move.actor_type, move.color, move.san]), [
    ["player", "w", "e4"], ["bot", "b", "e5"],
  ]);
  const detail = await gameService.getGame(user.id, created.game.id);
  assert.deepEqual(detail.history.map((move) => move.actor), [username, "Stockfish (medium)"]);
});

test("bot REST flow returns promptly and broadcasts the saved engine move", async () => {
  emittedEvents = [];
  const headers = {
    Authorization: `Bearer ${signToken({ sub: user.id })}`,
    "content-type": "application/json",
  };
  const createResponse = await fetch(`${baseUrl}/api/games`, {
    method: "POST", headers,
    body: JSON.stringify({ mode: "bot", time_control: "bullet", difficulty: "easy" }),
  });
  assert.equal(createResponse.status, 201);
  const { game } = await createResponse.json();

  const moveResponse = await fetch(`${baseUrl}/api/games/${game.id}/moves`, {
    method: "POST", headers, body: JSON.stringify({ from: "e2", to: "e4" }),
  });
  assert.equal(moveResponse.status, 200);
  const moveBody = await moveResponse.json();
  assert.equal(moveBody.bot_move_pending, true);
  assert.equal(moveBody.bot_move, null);

  let moves = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    moves = await GameMove.findAll({ where: { game_id: game.id }, order: [["ply", "ASC"]] });
    if (moves.length === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(moves.length, 2);
  assert.ok(emittedEvents.some((item) => item.event === "move" && item.data.move?.san === "e5"));
});
