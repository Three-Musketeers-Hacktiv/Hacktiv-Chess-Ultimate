/**
 * What the backend can actually do — audited against `server/` (routes, controllers, socket listeners).
 *
 * Features the server lists in `GET /` carry a `status` (`available` | `planned`); that is the source of
 * truth for them. Anything the server exposes no flag for is pinned here, so flipping a constant (or the
 * server's home catalogue) is all it takes to light a feature up.
 */

/** Verified absent in `server/` at the time of the audit: no socket listener / route exists. */
export const STATIC_CAPABILITIES = Object.freeze({
  rematch: false, // no `request_rematch` listener
  serverMatchmakingQueue: false, // no `join_room` queue — pairing is done client-side over open rooms
})

/** Fallback shown until `GET /` answers (or if it fails): everything the server calls planned stays "soon". */
const PLANNED = 'planned'

export function resolveCapabilities(home) {
  const feature = (id) => home?.features?.find((f) => f.id === id)?.status ?? PLANNED
  const mode = (id) => home?.game_modes?.find((m) => m.id === id)?.status ?? PLANNED

  return {
    ...STATIC_CAPABILITIES,
    bot: mode('bot') === 'available',
    // Analysis is attempted unless the server explicitly says it is still planned.
    analysis: home ? feature('analysis') !== PLANNED : true,
    history: feature('history') === 'available',
    dailyPuzzle: feature('daily_puzzle') === 'available',
    tournaments: feature('tournaments') === 'available',
  }
}
