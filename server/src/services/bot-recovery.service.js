function createBotRecoveryQueue({
  reserveBotMove,
  playBotMove,
  failPendingBotTurn,
  logger = console,
  retryDelayMs = 500,
}) {
  const pending = [];
  const knownIds = new Set();
  const runningIds = new Set();
  const resultHandlers = new Map();
  let retryTimer = null;
  let draining = false;
  let stopped = false;

  function notify(gameId, result) {
    const handler = resultHandlers.get(gameId);
    if (!handler || !result) return;
    resultHandlers.delete(gameId);
    try { handler(result); }
    catch (error) { logger.error(`Unable to publish recovered bot result for ${gameId}: ${error.message}`); }
  }

  function schedule(delay = 0) {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void drain();
    }, delay);
    retryTimer.unref?.();
  }

  async function drain() {
    if (stopped || draining) return;
    draining = true;
    try {
      while (!stopped && pending.length) {
        const gameId = pending[0];
        let reservation;
        try {
          reservation = reserveBotMove();
        } catch (error) {
          if (error.code === "ENGINE_BUSY") {
            schedule(retryDelayMs);
            return;
          }
          if (error.code === "ENGINE_UNAVAILABLE") {
            try {
              const result = await failPendingBotTurn(gameId);
              notify(gameId, result);
              pending.shift();
              knownIds.delete(gameId);
              resultHandlers.delete(gameId);
              continue;
            } catch (failureError) {
              logger.error(`Unable to close unavailable bot game ${gameId}: ${failureError.message}`);
              schedule(retryDelayMs);
              return;
            }
          }
          logger.error(`Unable to reserve Stockfish for game ${gameId}: ${error.message}`);
          schedule(retryDelayMs);
          return;
        }

        pending.shift();
        runningIds.add(gameId);
        void Promise.resolve()
          .then(() => playBotMove(gameId, reservation))
          .then((result) => notify(gameId, result))
          .catch((error) => {
            logger.error(`Unable to resume bot game ${gameId}: ${error.message}`);
            if (!stopped && !pending.includes(gameId)) pending.unshift(gameId);
            schedule(retryDelayMs);
          })
          .finally(() => {
            runningIds.delete(gameId);
            if (!pending.includes(gameId)) knownIds.delete(gameId);
            if (pending.length) schedule();
          });
      }
    } finally {
      draining = false;
    }
  }

  function enqueue(gameIds, onResult) {
    if (stopped) return;
    for (const value of gameIds) {
      const gameId = typeof value === "string" ? value : value?.id;
      if (!gameId) continue;
      if (typeof onResult === "function") resultHandlers.set(gameId, onResult);
      if (knownIds.has(gameId)) continue;
      knownIds.add(gameId);
      pending.push(gameId);
    }
    schedule();
  }

  function stop() {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  }

  function getState() {
    return { pending: [...pending], running: [...runningIds] };
  }

  return { enqueue, stop, getState };
}

module.exports = { createBotRecoveryQueue };
