const assert = require("node:assert/strict");
const { parseBestMove, parseUciScore, SKILL_LEVELS } = require("../src/services/stockfish.service");

assert.equal(parseBestMove("bestmove e2e4 ponder e7e5"), "e2e4");
assert.equal(parseBestMove("bestmove a7a8q"), "a7a8q");
assert.equal(parseBestMove("bestmove (none)"), null);
assert.equal(parseBestMove("info depth 12"), null);
assert.deepEqual(parseUciScore("info depth 10 score cp 35 nodes 1000", "8/8/8/8/8/8/4K3/6k1 w - - 0 1"), { cp: 35, mate: null });
assert.deepEqual(parseUciScore("info depth 10 score cp 35 nodes 1000", "8/8/8/8/8/8/4K3/6k1 b - - 0 1"), { cp: -35, mate: null });
assert.deepEqual(parseUciScore("info depth 10 score mate 2 nodes 1000", "8/8/8/8/8/8/4K3/6k1 b - - 0 1"), { cp: null, mate: -2 });
assert.deepEqual(parseUciScore("info depth 10 score mate 0 nodes 1000", "8/8/8/8/8/8/4K3/6k1 b - - 0 1"), { cp: null, mate: 1 });
assert.deepEqual(SKILL_LEVELS, { easy: 0, medium: 5, hard: 10 });

console.log("Stockfish UCI parsing and difficulty mapping passed.");
