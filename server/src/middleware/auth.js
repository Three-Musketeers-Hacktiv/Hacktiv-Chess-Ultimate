const { verifyToken } = require("../helpers/jwt");

const authenticate = (request, response, next) => {
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
    if (typeof payload.sub !== "string") throw new Error("Invalid token subject");
    request.user = { id: payload.sub };
    return next();
  } catch (error) {
    if (error.code === "JWT_SECRET_INVALID") return next(error);

    return response.status(401).json({
      status: "error",
      message: "Token tidak valid atau sudah kedaluwarsa.",
    });
  }
};

module.exports = authenticate;
