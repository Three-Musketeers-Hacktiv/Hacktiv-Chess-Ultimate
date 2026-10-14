/**
 * Elo payload helpers. The server attaches `elo` to ranked games:
 * `{ white: { before, change, after }, black: { … } }` where `change`/`after` stay `null` until the game
 * is over and the rating movement has been booked.
 */

/** The `{ before, change, after }` entry of one side, or `null` (no elo / unrated game). */
export function eloSide(elo, color) {
  if (!elo || !color) return null
  return (color === 'w' ? elo.white : elo.black) ?? null
}

/** The rating shown next to a player: after the game once booked, otherwise the rating they started with. */
export function currentRating(elo, color) {
  const side = eloSide(elo, color)
  return side ? (side.after ?? side.before) : null
}

/** `+16 ELO` / `-14 ELO` / `±0 ELO` for a booked change, `null` while it is not known yet. */
export function formatEloChange(change) {
  if (typeof change !== 'number') return null
  if (change > 0) return `+${change} ELO`
  if (change < 0) return `-${Math.abs(change)} ELO`
  return '±0 ELO'
}

/** `up | down | even` — drives the emerald / crimson / neutral treatment. */
export function eloTrend(change) {
  if (change > 0) return 'up'
  if (change < 0) return 'down'
  return 'even'
}
