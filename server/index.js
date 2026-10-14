require("dotenv").config();

const http = require("node:http");
const { Server } = require("socket.io");
const app = require("./src/app");
const { sequelize } = require("./src/models");
const authenticateSocket = require("./src/socket/auth");

const port = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
  },
});

app.set("io", io);
io.use(authenticateSocket);

async function startServer() {
  await sequelize.authenticate();

  httpServer.listen(port, () => {
    console.log(`Hacktiv Chess API listening on port ${port}`);
  });
}

async function stopServer() {
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
