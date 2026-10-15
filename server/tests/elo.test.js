const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  DEFAULT_RATING, K_FACTOR, MATCHMAKING_RANGE, calculateEloChanges, calculateNewRating, expectedScore, scoresFromResult,
} = require("../src/utils/elo");

test("constants follow the official Elo setup", () => {
  assert.equal(DEFAULT_RATING, 1500);
  assert.equal(K_FACTOR, 32);
  assert.equal(MATCHMAKING_RANGE, 200);
});

test("expected score follows 1 / (1 + 10^((Rb - Ra) / 400))", () => {
  assert.equal(expectedScore(1500, 1500), 0.5);
  assert.ok(Math.abs(expectedScore(1700, 1500) - 0.7597469266) < 1e-9);
  assert.ok(Math.abs(expectedScore(1500, 1700) - 0.2402530734) < 1e-9);
  assert.ok(Math.abs(expectedScore(1800, 1400) + expectedScore(1400, 1800) - 1) < 1e-12);
});

test("equal ratings: a win is +16, a loss is -16, a draw is 0", () => {
  assert.equal(calculateNewRating(1500, 1500, 1), 1516);
  assert.equal(calculateNewRating(1500, 1500, 0), 1484);
  assert.equal(calculateNewRating(1500, 1500, 0.5), 1500);
});

test("upsets move the ratings further than expected results", () => {
  const upset = calculateEloChanges(1400, 1800, "1-0");
  const expected = calculateEloChanges(1800, 1400, "1-0");
  assert.ok(upset.white.change > expected.white.change);
  assert.equal(upset.white.change, 29);
  assert.equal(expected.white.change, 3);
});

test("rating changes of both players are exact opposites (zero-sum), also for draws", () => {
  for (const result of ["1-0", "0-1", "1/2-1/2"]) {
    for (const [white, black] of [[1500, 1500], [1623, 1488], [1200, 1950], [2100, 2100]]) {
      const changes = calculateEloChanges(white, black, result);
      assert.equal(changes.white.change + changes.black.change, 0, `${result} ${white} vs ${black}`);
      assert.equal(changes.white.after, white + changes.white.change);
      assert.equal(changes.black.after, black + changes.black.change);
    }
  }
});

test("a draw between unequal players favours the lower rated one", () => {
  const changes = calculateEloChanges(1400, 1600, "1/2-1/2");
  assert.ok(changes.white.change > 0);
  assert.ok(changes.black.change < 0);
});

test("results map to scores and unfinished games are rejected", () => {
  assert.deepEqual(scoresFromResult("1-0"), { white: 1, black: 0 });
  assert.deepEqual(scoresFromResult("0-1"), { white: 0, black: 1 });
  assert.deepEqual(scoresFromResult("1/2-1/2"), { white: 0.5, black: 0.5 });
  assert.equal(scoresFromResult(null), null);
  assert.throws(() => calculateEloChanges(1500, 1500, null), RangeError);
});
