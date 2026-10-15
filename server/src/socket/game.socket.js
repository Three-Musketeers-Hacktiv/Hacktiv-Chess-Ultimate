const gameService = require("../services/game.service");
const rematchService = require("../services/rematch.service");

const toErrorPayload = (error, roomId) => ({
  code: error.code || "REMATCH_FAILED",
  message: error.status ? error.message : "Rematch tidak dapat diproses.",
  room_id: roomId,
});

function registerGameSocket(io) {
  io.on("connection", (socket) => {
    const userId = socket.data.user.id;
    socket.join(`user:${userId}`);
    socket.on("watch_game", async (payload = {}) => {
      const roomId = payload.room_id;
      if (typeof roomId !== "string") {
        socket.emit("game_error", { code: "INVALID_ROOM_ID", message: "ID game tidak valid." });
        return;
      }
      try {
        await gameService.watchGame(userId, roomId);
        const room = `game:${roomId}`;
        await socket.join(room);
        const snapshot = await gameService.watchGame(userId, roomId);
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

    // Rematch handshake. Answers go to the players' private `user:<id>` rooms (they have left the old game).
    socket.on("request_rematch", async (payload = {}) => {
      const roomId = payload.room_id;
      if (typeof roomId !== "string") {
        socket.emit("rematch_error", { code: "INVALID_ROOM_ID", message: "ID game tidak valid." });
        return;
      }
      try {
        const result = await rematchService.requestRematch(userId, roomId);
        if (result.status === "pending") {
          // Ack to every device of the requester, challenge to every device of the opponent.
          io.to(`user:${userId}`).emit("rematch_requested", { room_id: roomId });
          if (!result.repeated) {
            io.to(`user:${result.opponentId}`).emit("rematch_pending", { room_id: roomId, requested_by: result.requestedBy });
          }
          return;
        }
        for (const player of result.players) io.to(`user:${player.userId}`).emit("rematch_started", player.payload);
      } catch (error) {
        socket.emit("rematch_error", toErrorPayload(error, roomId));
      }
    });

    socket.on("decline_rematch", async (payload = {}) => {
      const roomId = payload.room_id;
      if (typeof roomId !== "string") {
        socket.emit("rematch_error", { code: "INVALID_ROOM_ID", message: "ID game tidak valid." });
        return;
      }
      try {
        const result = await rematchService.declineRematch(userId, roomId);
        if (result) io.to(`user:${result.notifyId}`).emit("rematch_declined", { room_id: roomId, declined_by: result.declinedBy });
      } catch (error) {
        socket.emit("rematch_error", toErrorPayload(error, roomId));
      }
    });
  });
}

module.exports = registerGameSocket;
