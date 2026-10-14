const jwt = require("jsonwebtoken");

const getSecretKey = () => {
  const secretKey = process.env.JWT_SECRET;

  if (!secretKey || Buffer.byteLength(secretKey, "utf8") < 32) {
    const error = new Error("JWT_SECRET must contain at least 32 bytes");
    error.code = "JWT_SECRET_INVALID";
    throw error;
  }

  return secretKey;
};

const signToken = (payload) =>
  jwt.sign(payload, getSecretKey(), { algorithm: "HS256", expiresIn: "7d" });

const verifyToken = (token) =>
  jwt.verify(token, getSecretKey(), { algorithms: ["HS256"] });

module.exports = { signToken, verifyToken };
