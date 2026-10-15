const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

const hash = (password) => bcrypt.hash(password, SALT_ROUNDS);

const compare = (password, hashedPassword) =>
  bcrypt.compare(password, hashedPassword);

module.exports = { hash, compare };
