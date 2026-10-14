require("dotenv").config();

const http = require("node:http");
const { Server } = require("socket.io");
const app = require("./src/app");
const { sequelize } = require("./src/models");
const authenticateSocket = require("./src/socket/auth");
const registerGameSocket = require("./src/socket/game.socket");
const stockfish = require("./src/services/stockfish.service");
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
  for (const game of pendingBotGames) {
    try {
      const reservation = stockfish.reserveBotMove();
      void playBotMove(game.id, reservation).catch((error) => {
        console.error(`Unable to resume bot game ${game.id}: ${error.message}`);
      });
    } catch (error) {
      console.error(`Unable to resume bot game ${game.id}: ${error.message}`);
      await failPendingBotTurn(game.id);
    }
  }
  timeoutInterval = setInterval(checkTimeouts, 1000);
  timeoutInterval.unref();

  httpServer.listen(port, () => {
    console.log(`Hacktiv Chess API listening on port ${port}`);
  });
}

async function stopServer() {
  clearInterval(timeoutInterval);
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
