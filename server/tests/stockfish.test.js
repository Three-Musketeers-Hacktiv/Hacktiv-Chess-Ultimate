const assert = require("node:assert/strict");
const { parseBestMove, SKILL_LEVELS } = require("../src/services/stockfish.service");

assert.equal(parseBestMove("bestmove e2e4 ponder e7e5"), "e2e4");
assert.equal(parseBestMove("bestmove a7a8q"), "a7a8q");
assert.equal(parseBestMove("bestmove (none)"), null);
assert.equal(parseBestMove("info depth 12"), null);
assert.deepEqual(SKILL_LEVELS, { easy: 0, medium: 5, hard: 10 });

console.log("Stockfish UCI parsing and difficulty mapping passed.");
