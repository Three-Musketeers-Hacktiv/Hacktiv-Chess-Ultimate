process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-secret-that-must-not-be-used-in-production";

const assert = require("node:assert/strict");
const { once } = require("node:events");
const { after, before, test } = require("node:test");
const http = require("node:http");
const { Op } = require("sequelize");
const app = require("../src/app");
const { sequelize, User } = require("../src/models");

const server = http.createServer(app);
const suffix = Date.now();
const email = `rename-${suffix}@example.com`;
const otherEmail = `rename-other-${suffix}@example.com`;
const password = "passwordrahasia123";
let baseUrl;
let token;

async function register(username, accountEmail) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, email: accountEmail, password }),
  });
  assert.equal(response.status, 201);
}

async function login(accountEmail) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: accountEmail, password }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).token;
}

async function updateUsername(body, authToken = token) {
  return fetch(`${baseUrl}/api/user/update-username`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

before(async () => {
  await sequelize.authenticate();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  await register(`ren_${suffix}`, email);
  await register(`taken_${suffix}`, otherEmail);
  token = await login(email);
});

after(async () => {
  await User.destroy({ where: { email: { [Op.in]: [email, otherEmail] } } });
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await sequelize.close();
});

test("update-username requires a JWT", async () => {
  const response = await updateUsername({ username: "new_name", password }, null);
  assert.equal(response.status, 401);
});

test("update-username rejects a wrong password without changing the username", async () => {
  const response = await updateUsername({ username: `new_${suffix}`, password: "password-yang-salah" });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, "Password salah. Konfirmasi gagal.");

  const user = await User.findOne({ where: { email } });
  assert.equal(user.username, `ren_${suffix}`);
});

test("update-username rejects a username that is already taken", async () => {
  const response = await updateUsername({ username: `taken_${suffix}`, password });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).message, "Username sudah digunakan.");
});

test("update-username saves a valid rename", async () => {
  const next = `ren2_${suffix}`;
  const response = await updateUsername({ username: next, password });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, "success");
  assert.equal(body.message, "Username berhasil diperbarui");
  assert.equal(body.user.username, next);

  const user = await User.findOne({ where: { email } });
  assert.equal(user.username, next);
});
