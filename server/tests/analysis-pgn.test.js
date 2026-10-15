process.env.NODE_ENV = "test";

const assert = require("node:assert/strict");
const { after, test } = require("node:test");
const stockfish = require("../src/services/stockfish.service");
const { analyzePgn, MAX_ANALYZED_PLIES } = require("../src/services/game-analysis.service");
const { sequelize } = require("../src/models");

const originalReserveAnalysis = stockfish.reserveAnalysis;
let reservations = 0;
let releases = 0;
let script = [];

stockfish.reserveAnalysis = () => {
  reservations += 1;
  return {
    run: async (fens) => script.slice(0, fens.length).map((entry) => ({ ...entry })),
    release() { releases += 1; },
  };
};

after(async () => {
  stockfish.reserveAnalysis = originalReserveAnalysis;
  await sequelize.close();
});

test("PGN analysis labels a big centipawn drop as a Blunder and suggests the engine's move", async () => {
  script = [
    { score: { cp: 30, mate: null }, best_move: "e2e4" },
    { score: { cp: -300, mate: null }, best_move: "e7e5" },
    { score: { cp: -310, mate: null }, best_move: null },
  ];
  const body = await analyzePgn("1. f3 e5");
  assert.equal(body.analyzed_plies, 2);
  assert.deepEqual(body.analysis.map(({ ply, color, move, label, best_alternative, centipawn_loss }) => (
    { ply, color, move, label, best_alternative, centipawn_loss }
  )), [
    { ply: 1, color: "w", move: "f3", label: "Blunder", best_alternative: "e4", centipawn_loss: 330 },
    { ply: 2, color: "b", move: "e5", label: "Best Move", best_alternative: null, centipawn_loss: 0 },
  ]);
  assert.deepEqual(body.analysis[0].evaluation, { cp: -300, mate: null });
  assert.equal(reservations, releases, "the engine reservation is always released");
});

test("PGN analysis accepts headers + result and reports mate scores", async () => {
  script = [
    { score: { cp: 0, mate: null }, best_move: "f2f3" },
    { score: { cp: 0, mate: null }, best_move: "e7e5" },
    { score: { cp: 0, mate: null }, best_move: "g2g4" },
    { score: { cp: 0, mate: null }, best_move: "d8h4" },
    { score: { cp: null, mate: -1 }, best_move: null },
  ];
  const body = await analyzePgn('[Event "t"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1');
  assert.equal(body.result, "0-1");
  assert.equal(body.analyzed_plies, 4);
  assert.deepEqual(body.analysis[3].evaluation, { cp: null, mate: -1 });
  assert.equal(body.analysis[3].centipawn_loss, null);
});

test("PGN analysis rejects bad input before touching the engine", async () => {
  const before = reservations;
  await assert.rejects(analyzePgn(undefined), { status: 400, code: "INVALID_PGN" });
  await assert.rejects(analyzePgn("   "), { status: 400, code: "INVALID_PGN" });
  await assert.rejects(analyzePgn("1. e4 e4"), { status: 400, code: "INVALID_PGN" });
  await assert.rejects(analyzePgn("x".repeat(9000)), { status: 413, code: "PGN_TOO_LARGE" });

  const loop = ["Nf3", "Nf6", "Ng1", "Ng8"];
  const long = Array.from({ length: MAX_ANALYZED_PLIES + 1 }, (_, index) => loop[index % loop.length]).join(" ");
  await assert.rejects(analyzePgn(long), { status: 422, code: "ANALYSIS_GAME_TOO_LONG" });
  assert.equal(reservations, before);
});

test("an empty game has nothing to analyse", async () => {
  assert.deepEqual(await analyzePgn("1-0"), { analyzed_plies: 0, result: null, analysis: [] });
});

test("engine failures surface as a release + 503 GameError", async () => {
  const before = { reservations, releases };
  stockfish.reserveAnalysis = () => {
    reservations += 1;
    return {
      run: async () => { throw new Error("boom"); },
      release() { releases += 1; },
    };
  };
  await assert.rejects(analyzePgn("1. e4"), { status: 503, code: "ENGINE_ANALYSIS_FAILED" });
  assert.equal(reservations - before.reservations, releases - before.releases);
});
