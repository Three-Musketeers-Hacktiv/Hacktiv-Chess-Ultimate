const gameService = require("./game.service");
const { enqueueGameAction } = require("./game-queue.service");

/** A challenge nobody answers is forgotten after this long. */
const REMATCH_TTL_MS = 5 * 60_000;

/**
 * Rematch handshake state, kept in memory per *finished* room (like the per-game action queue it only
 * covers a single backend instance): `roomId → { requestedBy: Set<userId>, startedRoomId, timer }`.
 * The first `request_rematch` records a pending challenge; the opponent's own request starts the new game.
 */
const rematches = new Map();

function forget(roomId) {
  clearTimeout(rematches.get(roomId)?.timer);
  rematches.delete(roomId);
}

function remember(roomId, entry) {
  clearTimeout(rematches.get(roomId)?.timer);
  const timer = setTimeout(() => rematches.delete(roomId), REMATCH_TTL_MS);
  timer.unref();
  rematches.set(roomId, { ...entry, timer });
}

/**
 * `request_rematch`. Resolves to
 *  - `{ status: "pending", opponentId, requestedBy }` — first request (or a repeat of it): tell the opponent;
 *  - `{ status: "started", roomId, players: [{ userId, payload }] }` — the opponent had already asked:
 *    a new game with swapped colours exists and both players must be told.
 * Rejects with a `GameError` (not a player, game not finished, bot game, a player is busy, …).
 */
function requestRematch(userId, roomId) {
  return enqueueGameAction(`rematch:${roomId}`, async () => {
    const context = await gameService.getRematchContext(userId, roomId);
    const entry = rematches.get(roomId);

    if (entry?.startedRoomId) {
      throw new gameService.GameError(409, "REMATCH_ALREADY_STARTED", "Rematch untuk game ini sudah dimulai.");
    }
    if (!entry) {
      remember(roomId, { requestedBy: new Set([userId]), startedRoomId: null });
      return { status: "pending", roomId, opponentId: context.opponentId, requestedBy: context.username };
    }
    if (entry.requestedBy.has(userId)) {
      return { status: "pending", repeated: true, roomId, opponentId: context.opponentId, requestedBy: context.username };
    }

    const started = await gameService.startRematch(roomId);
    remember(roomId, { requestedBy: entry.requestedBy, startedRoomId: started.roomId });
    return { status: "started", ...started };
  });
}

/**
 * `decline_rematch`. Drops a pending challenge — the opponent's (decline) or the player's own (withdraw,
 * e.g. they left the arena) — and resolves to `{ roomId, notifyId, declinedBy }` so the other side can be
 * told; resolves to `null` when there is nothing pending (never asked, or the rematch already started).
 */
function declineRematch(userId, roomId) {
  return enqueueGameAction(`rematch:${roomId}`, async () => {
    const context = await gameService.getRematchContext(userId, roomId);
    const entry = rematches.get(roomId);
    if (!entry || entry.startedRoomId) return null;
    forget(roomId);
    return { roomId, notifyId: context.opponentId, declinedBy: context.username };
  });
}

module.exports = { requestRematch, declineRematch, REMATCH_TTL_MS };
