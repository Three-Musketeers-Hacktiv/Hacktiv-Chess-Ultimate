/**
 * Chess Elo rating engine.
 *
 *   E_A   = 1 / (1 + 10 ^ ((R_B - R_A) / 400))
 *   R_new = R_old + K * (S_A - E_A)         with K = 32
 *
 * S_A is 1 for a win, 0.5 for a draw and 0 for a loss. Ratings are whole numbers, so every new rating is
 * rounded half away from zero; the two players of a game therefore always gain/lose the exact same amount.
 */

const DEFAULT_RATING = 1500;
const K_FACTOR = 32;
/** Ranked matchmaking only pairs players whose ratings differ by at most this many points. */
const MATCHMAKING_RANGE = 200;

const roundHalfAwayFromZero = (value) => Math.sign(value) * Math.round(Math.abs(value));

/** Probability-weighted score (0..1) that a player rated `ratingA` earns against `ratingB`. */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** New whole-number rating of player A after scoring `score` (1 | 0.5 | 0) against player B. */
function calculateNewRating(ratingA, ratingB, score, kFactor = K_FACTOR) {
  return ratingA + roundHalfAwayFromZero(kFactor * (score - expectedScore(ratingA, ratingB)));
}

/** Score of White / Black for a PGN result string, or `null` when the result is not a finished game. */
function scoresFromResult(result) {
  if (result === "1-0") return { white: 1, black: 0 };
  if (result === "0-1") return { white: 0, black: 1 };
  if (result === "1/2-1/2") return { white: 0.5, black: 0.5 };
  return null;
}

/**
 * Rating movement of a finished game, computed from both players' pre-game ratings.
 * Returns `{ white: { before, after, change }, black: { ... } }`.
 */
function calculateEloChanges(whiteRating, blackRating, result) {
  const scores = scoresFromResult(result);
  if (!scores) throw new RangeError(`Cannot rate a game with result "${result}".`);
  const side = (own, other, score) => {
    const after = calculateNewRating(own, other, score);
    return { before: own, after, change: after - own };
  };
  return {
    white: side(whiteRating, blackRating, scores.white),
    black: side(blackRating, whiteRating, scores.black),
  };
}

module.exports = {
  DEFAULT_RATING, K_FACTOR, MATCHMAKING_RANGE,
  expectedScore, calculateNewRating, scoresFromResult, calculateEloChanges,
};
