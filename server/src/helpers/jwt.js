const jwt = require("jsonwebtoken");
const { createHash } = require("node:crypto");

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

const hashToken = (token) => createHash("sha256").update(token).digest("hex");

module.exports = { signToken, verifyToken, hashToken };
