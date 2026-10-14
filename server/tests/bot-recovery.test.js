const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createBotRecoveryQueue } = require("../src/services/bot-recovery.service");

async function waitFor(predicate, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Condition was not met before timeout.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("a full Stockfish queue keeps a recovered game pending and retries it", async (context) => {
  let capacityAvailable = false;
  let reserveAttempts = 0;
  let failureFinalizations = 0;
  let playedGames = 0;
  let notifiedMove = null;
  const recovery = createBotRecoveryQueue({
    reserveBotMove() {
      reserveAttempts += 1;
      if (!capacityAvailable) {
        const error = new Error("queue full");
        error.code = "ENGINE_BUSY";
        throw error;
      }
      return { release() {} };
    },
    async playBotMove() { playedGames += 1; return { move: "Nc6" }; },
    async failPendingBotTurn() { failureFinalizations += 1; },
    logger: { error() {} },
    retryDelayMs: 10,
  });
  context.after(() => recovery.stop());

  recovery.enqueue(["game-1"], (result) => { notifiedMove = result.move; });
  await waitFor(() => reserveAttempts > 0);
  assert.deepEqual(recovery.getState().pending, ["game-1"]);
  assert.equal(failureFinalizations, 0);
  assert.equal(playedGames, 0);

  capacityAvailable = true;
  await waitFor(() => playedGames === 1 && recovery.getState().pending.length === 0 && recovery.getState().running.length === 0);
  assert.equal(failureFinalizations, 0);
  assert.equal(notifiedMove, "Nc6");
});

test("an unavailable Stockfish engine finalizes a pending game separately from queue saturation", async (context) => {
  let failureFinalizations = 0;
  let playedGames = 0;
  const recovery = createBotRecoveryQueue({
    reserveBotMove() {
      const error = new Error("engine unavailable");
      error.code = "ENGINE_UNAVAILABLE";
      throw error;
    },
    async playBotMove() { playedGames += 1; },
    async failPendingBotTurn() { failureFinalizations += 1; },
    logger: { error() {} },
    retryDelayMs: 10,
  });
  context.after(() => recovery.stop());

  recovery.enqueue(["game-2"]);
  await waitFor(() => recovery.getState().pending.length === 0);
  assert.equal(failureFinalizations, 1);
  assert.equal(playedGames, 0);
});

test("an unexpected move persistence failure is retried without finalizing the game", async (context) => {
  let playedGames = 0;
  let failureFinalizations = 0;
  const recovery = createBotRecoveryQueue({
    reserveBotMove() { return { release() {} }; },
    async playBotMove() {
      playedGames += 1;
      if (playedGames === 1) throw new Error("temporary database failure");
    },
    async failPendingBotTurn() { failureFinalizations += 1; },
    logger: { error() {} },
    retryDelayMs: 10,
  });
  context.after(() => recovery.stop());

  recovery.enqueue(["game-3"]);
  await waitFor(() => playedGames === 2 && recovery.getState().pending.length === 0 && recovery.getState().running.length === 0);
  assert.equal(failureFinalizations, 0);
});
