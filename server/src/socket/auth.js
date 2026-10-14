const { verifyToken } = require("../helpers/jwt");

const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) return next(new Error("Authentication required"));

  try {
    const payload = verifyToken(token);
    if (typeof payload.sub !== "string") throw new Error("Invalid token subject");
    socket.data.user = { id: payload.sub };
    return next();
  } catch (error) {
    return next(
      error.code === "JWT_SECRET_INVALID"
        ? error
        : new Error("Invalid or expired token"),
    );
  }
};

module.exports = authenticateSocket;
