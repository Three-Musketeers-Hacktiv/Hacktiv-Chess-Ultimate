require("dotenv").config();

const http = require("node:http");
const { Server } = require("socket.io");
const app = require("./src/app");
const { sequelize } = require("./src/models");
const authenticateSocket = require("./src/socket/auth");
const registerGameSocket = require("./src/socket/game.socket");
const stockfish = require("./src/services/stockfish.service");
const { createBotRecoveryQueue } = require("./src/services/bot-recovery.service");
const {
  expireGame, findActiveGameIds, findPendingBotGames, playBotMove, failPendingBotTurn,
} = require("./src/services/game.service");

const port = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const httpServer = http.createServer(app);
let timeoutInterval;
let checkingTimeouts = false;
const botRecovery = createBotRecoveryQueue({
  reserveBotMove: () => stockfish.reserveBotMove(),
  playBotMove,
  failPendingBotTurn,
});
app.set("retryBotTurn", (gameId, onResult) => botRecovery.enqueue([gameId], onResult));
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
  },
});

app.set("io", io);
io.use(authenticateSocket);
registerGameSocket(io);

async function startServer() {
  await sequelize.authenticate();

  const checkTimeouts = async () => {
    if (checkingTimeouts) return;
    checkingTimeouts = true;
    try {
      const gameIds = await findActiveGameIds();
      const results = await Promise.all(gameIds.map((gameId) => expireGame(gameId)));
      for (const result of results.filter(Boolean)) {
        io.to(`game:${result.game.id}`).emit("game_over", {
          room_id: result.game.id,
          status: "completed",
          termination_reason: "timeout",
          winner: result.game.result === "1-0" ? result.white : result.game.result === "0-1" ? result.black : null,
          result: result.game.result,
          pgn: result.pgn,
          clocks: result.game.clocks,
          ranked: Boolean(result.game.ranked),
          elo: result.game.elo || null,
        });
      }
    } catch (error) {
      console.error(`Unable to check game clocks: ${error.message}`);
    } finally {
      checkingTimeouts = false;
    }
  };
  await checkTimeouts();
  const pendingBotGames = await findPendingBotGames();
  botRecovery.enqueue(pendingBotGames);
  timeoutInterval = setInterval(checkTimeouts, 1000);
  timeoutInterval.unref();

  httpServer.listen(port, () => {
    console.log(`Hacktiv Chess API listening on port ${port}`);
    const engine = stockfish.availabilityReport();
    if (engine.available) console.log(`[stockfish] engine ready: ${engine.path}`);
    else console.warn(`[stockfish] engine UNAVAILABLE — bot games and analysis will answer 503. ${engine.reason}`);
  });
}

async function stopServer() {
  clearInterval(timeoutInterval);
  botRecovery.stop();
  io.close();
  await sequelize.close();
  process.exit(0);
}

process.once("SIGINT", stopServer);
process.once("SIGTERM", stopServer);

startServer().catch((error) => {
  console.error(`Unable to start server: ${error.message}`);
  process.exitCode = 1;
});
