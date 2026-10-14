process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "logout-test-secret-that-is-not-for-production";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, test } = require("node:test");
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { hashToken, signToken } = require("../src/helpers/jwt");
const authenticateSocket = require("../src/socket/auth");
const app = require("../src/app");
const { RevokedToken, User, sequelize } = require("../src/models");

const userSuffix = Date.now();
const tokenId = randomUUID();
let user;
let token;
let server;
let baseUrl;
let disconnectedRoom;

app.set("io", {
  in(room) {
    return { disconnectSockets: () => { disconnectedRoom = room; } };
  },
});

before(async () => {
  await sequelize.authenticate();
  user = await User.create({
    username: `logout_${userSuffix}`,
    email: `logout_${userSuffix}@example.com`,
    password_hash: "temporary-test-password",
  });
  token = signToken({ sub: user.id, jti: tokenId });
  server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await RevokedToken.destroy({ where: { token_hash: hashToken(token) } });
  if (user) await User.destroy({ where: { id: user.id } });
  if (server?.listening) {
    await new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()),
    );
  }
  await sequelize.close();
});

function authenticateSocketToken(value) {
  return new Promise((resolve) => {
    authenticateSocket({ handshake: { auth: { token: value } }, data: {} }, resolve);
  });
}

test("logout revokes the current JWT for REST and Socket.IO only", async () => {
  const missingToken = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST" });
  assert.equal(missingToken.status, 401);

  const headers = { authorization: `Bearer ${token}` };
  const beforeLogout = await fetch(`${baseUrl}/`, { headers });
  assert.equal(beforeLogout.status, 200);
  assert.equal((await authenticateSocketToken(token)), undefined);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: "POST", headers });
  assert.equal(logout.status, 200);
  assert.deepEqual(await logout.json(), { status: "success", message: "Logout berhasil." });
  assert.equal(disconnectedRoom, `token:${hashToken(token)}`);

  const revokedRecord = await RevokedToken.findByPk(hashToken(token));
  assert.ok(revokedRecord);
  assert.notEqual(revokedRecord.token_hash, token);

  const afterLogout = await fetch(`${baseUrl}/`, { headers });
  assert.equal(afterLogout.status, 401);
  const revokedSocketError = await authenticateSocketToken(token);
  assert.match(revokedSocketError.message, /Invalid or expired token/);

  const otherSessionToken = signToken({ sub: user.id, jti: randomUUID() });
  const otherSession = await fetch(`${baseUrl}/`, {
    headers: { authorization: `Bearer ${otherSessionToken}` },
  });
  assert.equal(otherSession.status, 200);
  assert.equal(await authenticateSocketToken(otherSessionToken), undefined);
});
