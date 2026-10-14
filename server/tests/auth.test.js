process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-secret-that-must-not-be-used-in-production";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, test } = require("node:test");
const http = require("node:http");
const { compare } = require("../src/helpers/bcrypt");
const { verifyToken } = require("../src/helpers/jwt");
const authenticateSocket = require("../src/socket/auth");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");

const server = http.createServer(app);
const suffix = Date.now();
const email = `auth-${suffix}@example.com`;
const username = `auth_${suffix}`;
let baseUrl;

before(async () => {
  await sequelize.authenticate();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
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
