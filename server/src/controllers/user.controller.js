const { UniqueConstraintError, ValidationError } = require("sequelize");
const { compare } = require("../helpers/bcrypt");
const { User } = require("../models");

const USERNAME_RE = /^[a-z0-9_-]{3,24}$/;

const updateUsername = async (request, response, next) => {
  const { username, password } = request.body || {};

  if (typeof username !== "string" || typeof password !== "string") {
    return response.status(400).json({ status: "error", message: "Username dan password wajib berupa teks." });
  }

  const normalizedUsername = username.trim().toLowerCase();

  if (!USERNAME_RE.test(normalizedUsername)) {
    return response.status(400).json({
      status: "error",
      message: "Username harus 3–24 karakter dan hanya berisi huruf, angka, _ atau -.",
    });
  }

  if (!password) {
    return response.status(400).json({ status: "error", message: "Password wajib diisi." });
  }

  try {
    const user = await User.findByPk(request.user.id, {
      attributes: ["id", "username", "password_hash"],
    });

    if (!user) {
      return response.status(401).json({ status: "error", message: "Akun tidak ditemukan." });
    }

    if (!(await compare(password, user.password_hash))) {
      return response.status(401).json({ status: "error", message: "Password salah. Konfirmasi gagal." });
    }

    if (user.username !== normalizedUsername) {
      user.username = normalizedUsername;
      await user.save();
    }

    return response.status(200).json({
      status: "success",
      message: "Username berhasil diperbarui",
      user: { username: user.username },
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      return response.status(409).json({ status: "error", message: "Username sudah digunakan." });
    }
    if (error instanceof ValidationError) {
      return response.status(400).json({
        status: "error",
        message: "Username harus 3–24 karakter dan hanya berisi huruf, angka, _ atau -.",
      });
    }
    return next(error);
  }
};

module.exports = { updateUsername };
