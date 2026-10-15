const { Op, UniqueConstraintError, ValidationError } = require("sequelize");
const { compare } = require("../helpers/bcrypt");
const { signToken } = require("../helpers/jwt");
const { RevokedToken, User } = require("../models");

const register = async (request, response, next) => {
  const { username, email, password } = request.body || {};

  if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
    return response.status(400).json({ status: "error", message: "Username, email, dan password wajib berupa teks." });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();
  const passwordLength = Array.from(password).length;

  if (!/^[a-z0-9_-]{3,24}$/.test(normalizedUsername)) {
    return response.status(400).json({
      status: "error",
      message: "Username harus 3–24 karakter dan hanya berisi huruf, angka, _ atau -.",
    });
  }

  if (!normalizedEmail || normalizedEmail.length > 254) {
    return response.status(400).json({ status: "error", message: "Email tidak valid." });
  }

  if (passwordLength < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return response.status(400).json({
      status: "error",
      message: "Password harus minimal 8 karakter dan maksimal 72 byte dalam UTF-8.",
    });
  }

  try {
    await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      password_hash: password,
    });

    return response.status(201).json({
      status: "success",
      message: "Akun berhasil dibuat. Silakan login.",
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return response.status(409).json({
        status: "error",
        message: "Username atau email sudah digunakan.",
      });
    }
    if (error instanceof ValidationError) {
      return response.status(400).json({ status: "error", message: "Email tidak valid." });
    }
    return next(error);
  }
};

const login = async (request, response, next) => {
  const { email, password } = request.body || {};

  if (typeof email !== "string" || typeof password !== "string" || !email.trim()) {
    return response.status(400).json({ status: "error", message: "Email dan password wajib diisi." });
  }

  try {
    const user = await User.findOne({
      where: { email: email.trim().toLowerCase() },
      attributes: ["id", "username", "password_hash"],
    });

    if (!user || !(await compare(password, user.password_hash))) {
      return response.status(401).json({ status: "error", message: "Email atau password salah." });
    }

    const token = signToken({ sub: user.id });
    return response.status(200).json({
      status: "success",
      token,
      user: { id: user.id, username: user.username },
    });
  } catch (error) {
    return next(error);
  }
};

const logout = async (request, response, next) => {
  try {
    await RevokedToken.destroy({ where: { expires_at: { [Op.lte]: new Date() } } });
    await RevokedToken.create({
      token_hash: request.auth.tokenHash,
      expires_at: request.auth.expiresAt,
    });
    request.app.get("io")?.in?.(`token:${request.auth.tokenHash}`).disconnectSockets(true);
    return response.status(200).json({ status: "success", message: "Logout berhasil." });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return response.status(200).json({ status: "success", message: "Logout berhasil." });
    }
    return next(error);
  }
};

module.exports = { register, login, logout };
