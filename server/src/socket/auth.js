const { hashToken, verifyToken } = require("../helpers/jwt");
const { RevokedToken } = require("../models");

const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) return next(new Error("Authentication required"));

  try {
    const payload = verifyToken(token);
    if (typeof payload.sub !== "string" || !Number.isInteger(payload.exp)) throw new Error("Invalid token claims");
    const tokenHash = hashToken(token);
    if (await RevokedToken.findByPk(tokenHash)) throw new Error("Revoked token");
    socket.data.user = { id: payload.sub };
    socket.data.tokenHash = tokenHash;
    return next();
  } catch (error) {
    if (error.name?.startsWith("Sequelize")) return next(error);
    return next(
      error.code === "JWT_SECRET_INVALID"
        ? error
        : new Error("Invalid or expired token"),
    );
  }
};

module.exports = authenticateSocket;
