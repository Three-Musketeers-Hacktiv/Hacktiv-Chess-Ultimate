process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-secret-that-must-not-be-used-in-production";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, test } = require("node:test");
const http = require("node:http");
const { compare } = require("../src/helpers/bcrypt");
const { signToken, verifyToken } = require("../src/helpers/jwt");
const authenticateSocket = require("../src/socket/auth");
const registerGameSocket = require("../src/socket/game.socket");
const app = require("../src/app");
const { sequelize, Game, User } = require("../src/models");

const server = http.createServer(app);
const suffix = Date.now();
const email = `auth-${suffix}@example.com`;
const username = `auth_${suffix}`;
let baseUrl;
let emittedEvents = [];
let createdGameId;
let secondEmailCleanup;

app.set("io", {
  to(room) {
    return { emit: (event, data) => emittedEvents.push({ room, event, data }) };
  },
});

before(async () => {
  await sequelize.authenticate();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (createdGameId) await Game.destroy({ where: { id: createdGameId } });
  if (secondEmailCleanup) await User.destroy({ where: { email: secondEmailCleanup } });
  await User.destroy({ where: { email } });
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await sequelize.close();
});

test("register hashes passwords, login issues JWT, and protected home requires JWT", async () => {
  const invalid = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "x", email, password: "short" }),
  });
  assert.equal(invalid.status, 400);

  const tooLongPassword = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "auth_long", email, password: "a".repeat(73) }),
  });
  assert.equal(tooLongPassword.status, 400);

  const registration = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: `  ${username}  `,
      email: ` ${email.toUpperCase()} `,
      password: "passwordrahasia123",
    }),
  });
  assert.equal(registration.status, 201);

  const user = await User.findOne({ where: { email } });
  assert.ok(user);
  assert.equal(user.username, username);
  assert.notEqual(user.password_hash, "passwordrahasia123");
  assert.equal(await compare("passwordrahasia123", user.password_hash), true);

  const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, email, password: "passwordrahasia123" }),
  });
  assert.equal(duplicate.status, 409);

  const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "password-yang-salah" }),
  });
  assert.equal(badLogin.status, 401);
  assert.equal((await badLogin.json()).message, "Email atau password salah.");

  const unknownEmailLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: `unknown-${email}`, password: "passwordrahasia123" }),
  });
  assert.equal(unknownEmailLogin.status, 401);
  assert.equal((await unknownEmailLogin.json()).message, "Email atau password salah.");

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: email.toUpperCase(), password: "passwordrahasia123" }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  const payload = verifyToken(loginBody.token);
  assert.equal(payload.sub, user.id);
  assert.equal(payload.exp - payload.iat, 7 * 24 * 60 * 60);
  assert.deepEqual(Object.keys(loginBody.user).sort(), ["id", "username"]);

  const socket = { handshake: { auth: { token: loginBody.token } }, data: {} };
  await new Promise((resolve, reject) =>
    authenticateSocket(socket, (error) => (error ? reject(error) : resolve())),
  );
  assert.equal(socket.data.user.id, user.id);

  await new Promise((resolve) =>
    authenticateSocket({ handshake: { auth: {} }, data: {} }, (error) => {
      assert.match(error.message, /Authentication required/);
      resolve();
    }),
  );

  const unauthorized = await fetch(`${baseUrl}/`);
  assert.equal(unauthorized.status, 401);

  const invalidToken = await fetch(`${baseUrl}/`, {
    headers: { authorization: "Bearer invalid-token" },
  });
  assert.equal(invalidToken.status, 401);

  const home = await fetch(`${baseUrl}/`, {
    headers: { authorization: `Bearer ${loginBody.token}` },
  });
  assert.equal(home.status, 200);
  const homeBody = await home.json();
  assert.equal(homeBody.home.user.username, username);
  assert.deepEqual(homeBody.home.stats, { wins: 0, draws: 0, losses: 0 });

  const secondEmail = `pvp-${suffix}@example.com`;
  const secondUsername = `pvp_${suffix}`;
  secondEmailCleanup = secondEmail;
  const secondUser = await User.create({ username: secondUsername, email: secondEmail, password_hash: "passwordrahasia123" });
  const secondToken = signToken({ sub: secondUser.id });
  const firstHeaders = { authorization: `Bearer ${loginBody.token}`, "content-type": "application/json" };
  const secondHeaders = { authorization: `Bearer ${secondToken}`, "content-type": "application/json" };

  const createdRoom = await fetch(`${baseUrl}/api/games`, {
    method: "POST", headers: firstHeaders,
    body: JSON.stringify({ mode: "pvp", time_control: "bullet" }),
  });
  assert.equal(createdRoom.status, 201);
  const room = (await createdRoom.json()).game;
  createdGameId = room.id;
  assert.equal(room.status, "waiting");
  assert.equal(room.color, "w");

  const openRooms = await fetch(`${baseUrl}/api/games/open`, { headers: firstHeaders });
  assert.ok((await openRooms.json()).games.some((game) => game.id === room.id));

  const ownJoin = await fetch(`${baseUrl}/api/games/${room.id}/join`, { method: "POST", headers: firstHeaders });
  assert.equal(ownJoin.status, 409);

  const joined = await fetch(`${baseUrl}/api/games/${room.id}/join`, { method: "POST", headers: secondHeaders });
  assert.equal(joined.status, 200);
  assert.equal((await joined.json()).game.color, "b");

  const wrongTurn = await fetch(`${baseUrl}/api/games/${room.id}/moves`, {
    method: "POST", headers: secondHeaders, body: JSON.stringify({ from: "e7", to: "e5" }),
  });
  assert.equal(wrongTurn.status, 409);
  const illegalMove = await fetch(`${baseUrl}/api/games/${room.id}/moves`, {
    method: "POST", headers: firstHeaders, body: JSON.stringify({ from: "e2", to: "e5" }),
  });
  assert.equal(illegalMove.status, 400);

  const whiteMove = await fetch(`${baseUrl}/api/games/${room.id}/moves`, {
    method: "POST", headers: firstHeaders, body: JSON.stringify({ from: "e2", to: "e4" }),
  });
  assert.equal(whiteMove.status, 200);
  const whiteMoveBody = await whiteMove.json();
  assert.equal(whiteMoveBody.history.length, 1);
  assert.equal(whiteMoveBody.history[0].san, "e4");
  assert.equal(whiteMoveBody.clocks.active_color, "b");
  assert.ok(emittedEvents.some((item) => item.event === "move" && item.room === `game:${room.id}`));

  const blackMove = await fetch(`${baseUrl}/api/games/${room.id}/moves`, {
    method: "POST", headers: secondHeaders, body: JSON.stringify({ from: "e7", to: "e5" }),
  });
  assert.equal(blackMove.status, 200);
  assert.equal((await blackMove.json()).history.length, 2);

  const detail = await fetch(`${baseUrl}/api/games/${room.id}`, { headers: firstHeaders });
  assert.equal(detail.status, 200);
  assert.match((await detail.json()).game.pgn, /1\. e4 e5 \*/);
  const live = await fetch(`${baseUrl}/api/games/live`, { headers: firstHeaders });
  assert.ok((await live.json()).games.some((game) => game.id === room.id));

  let connectionHandler;
  registerGameSocket({ on: (_event, handler) => { connectionHandler = handler; } });
  const socketHandlers = {};
  const socketEvents = [];
  const fakeSocket = {
    data: { user: { id: user.id } },
    on: (event, handler) => { socketHandlers[event] = handler; },
    join: async (name) => socketEvents.push(`joined:${name}`),
    leave: async (name) => socketEvents.push(`left:${name}`),
    emit: (event, data) => socketEvents.push({ event, data }),
  };
  connectionHandler(fakeSocket);
  await socketHandlers.watch_game({ room_id: room.id });
  assert.ok(socketEvents.some((event) => typeof event === "string" && event === `joined:game:${room.id}`));
  assert.ok(socketEvents.some((event) => typeof event === "object" && event.event === "game_state"));

  const drawOffer = await fetch(`${baseUrl}/api/games/${room.id}/draw-offers`, { method: "POST", headers: firstHeaders });
  assert.equal(drawOffer.status, 200);
  assert.ok(emittedEvents.some((item) => item.event === "draw_offer" && item.room === `game:${room.id}`));
  const declineDraw = await fetch(`${baseUrl}/api/games/${room.id}/draw-offers/response`, {
    method: "POST", headers: secondHeaders, body: JSON.stringify({ decision: "decline" }),
  });
  assert.equal(declineDraw.status, 200);

  const resign = await fetch(`${baseUrl}/api/games/${room.id}/resign`, { method: "POST", headers: secondHeaders });
  assert.equal(resign.status, 200);
  assert.equal((await resign.json()).game.termination_reason, "resignation");

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const rejectedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "wrong-password" }),
    });
    assert.equal(rejectedLogin.status, 401);
  }

  const limitedLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
  assert.equal(limitedLogin.status, 429);
  assert.ok(limitedLogin.headers.has("retry-after"));

  const rejected = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "x", email, password: "short" }),
  });
  assert.equal(rejected.status, 400);

  const limited = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "another_test", email: `other-${email}`, password: "passwordrahasia123" }),
  });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.has("retry-after"));
});
