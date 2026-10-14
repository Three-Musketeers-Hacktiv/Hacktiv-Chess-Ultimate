const gameService = require("../services/game.service");

function registerGameSocket(io) {
  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.user.id}`);
    socket.join(`token:${socket.data.tokenHash}`);
    socket.on("watch_game", async (payload = {}) => {
      const roomId = payload.room_id;
      if (typeof roomId !== "string") {
        socket.emit("game_error", { code: "INVALID_ROOM_ID", message: "ID game tidak valid." });
        return;
      }
      try {
        await gameService.watchGame(socket.data.user.id, roomId);
        const room = `game:${roomId}`;
        await socket.join(room);
        const snapshot = await gameService.watchGame(socket.data.user.id, roomId);
        socket.emit("game_state", snapshot);
      } catch (error) {
        await socket.leave(`game:${roomId}`);
        socket.emit("game_error", {
          code: error.code || "GAME_NOT_FOUND",
          message: error.message || "Game tidak ditemukan.",
          room_id: roomId,
        });
      }
    });
  });
}

module.exports = registerGameSocket;
