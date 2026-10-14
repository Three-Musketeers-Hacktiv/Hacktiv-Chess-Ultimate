const cors = require("cors");
const express = require("express");
const authenticate = require("./middleware/auth");
const authRoutes = require("./routes/auth.routes");
const gameRoutes = require("./routes/game.routes");
const profileRoutes = require("./routes/profile.routes");
const { getHome } = require("./controllers/home.controller");

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "16kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/profile", profileRoutes);

app.get("/health", (_request, response) => {
  response.status(200).json({ status: "ok" });
});

app.get("/", authenticate, getHome);

app.use((error, _request, response, _next) => {
  if (error.type === "entity.too.large") {
    return response.status(413).json({ status: "error", message: "Ukuran request terlalu besar." });
  }
  if (error.type === "entity.parse.failed") {
    return response.status(400).json({ status: "error", message: "Format JSON tidak valid." });
  }

  console.error(error);
  return response.status(500).json({ status: "error", message: "Terjadi kesalahan pada server." });
});

module.exports = app;
