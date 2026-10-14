const { hashToken, verifyToken } = require("../helpers/jwt");
const { RevokedToken } = require("../models");

const authenticate = async (request, response, next) => {
  const authorization = request.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return response.status(401).json({
      status: "error",
      message: "Token autentikasi diperlukan.",
    });
  }

  try {
    const payload = verifyToken(token);
    if (typeof payload.sub !== "string" || !Number.isInteger(payload.exp)) throw new Error("Invalid token claims");
    const tokenHash = hashToken(token);
    if (await RevokedToken.findByPk(tokenHash)) {
      return response.status(401).json({ status: "error", message: "Token tidak valid atau sudah kedaluwarsa." });
    }
    request.user = { id: payload.sub };
    request.auth = { tokenHash, expiresAt: new Date(payload.exp * 1000) };
    return next();
  } catch (error) {
    if (error.code === "JWT_SECRET_INVALID") return next(error);
    if (error.name?.startsWith("Sequelize")) return next(error);

    return response.status(401).json({
      status: "error",
      message: "Token tidak valid atau sudah kedaluwarsa.",
    });
  }
};

module.exports = authenticate;
