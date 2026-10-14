/**
 * What the backend can actually do — audited against `server/` (routes, controllers, socket listeners).
 *
 * `GET /` publishes availability in three places and the resolver reads all of them:
 *  - `home.game_modes`   `[{ id: 'bot' | 'ranked' | …, status }]`
 *  - `home.features`     `[{ id: 'analysis' | 'rematch' | …, status }]`
 *  - `home.capabilities` `{ ranked: 'available', rematch: 'available', … }`
 * A flag counts as on for `available | active | enabled | ready | online | true`. Engine availability is
 * matched by keyword (`bot`, `engine`, `stockfish`) and ranked by `ranked`, so a renamed id on the server
 * does not silently lock the feature again.
 *
 * Flags are remembered (`lib/storage` → `capabilityCache`): until `GET /` answers — or when it fails, e.g.
 * while the server restarts — the last answer keeps the menus unlocked instead of flashing "locked".
 */

/** Verified present in `server/`: `POST /api/games` queues/pairs; `DELETE /:id/matchmaking` cancels. */
export const STATIC_CAPABILITIES = Object.freeze({
  serverMatchmakingQueue: true,
})

const ON = new Set(['available', 'active', 'enabled', 'ready', 'online', 'on', 'true'])

const isOn = (value) => {
  if (value === true) return true
  if (value && typeof value === 'object') return isOn(value.status ?? value.available ?? value.enabled)
  return typeof value === 'string' && ON.has(value.trim().toLowerCase())
}

/** Every `{ id, on }` pair the server published, whichever of the three shapes it used. */
function publishedFlags(home) {
  const flags = []
  for (const list of [home?.game_modes, home?.features]) {
    if (Array.isArray(list)) for (const entry of list) flags.push({ id: String(entry?.id ?? ''), on: isOn(entry?.status) })
  }
  const map = home?.capabilities
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    for (const [id, value] of Object.entries(map)) flags.push({ id, on: isOn(value) })
  }
  return flags
}

export const CAPABILITY_KEYS = Object.freeze(['bot', 'ranked', 'rematch', 'analysis', 'history', 'dailyPuzzle', 'tournaments'])

const NONE = Object.freeze(Object.fromEntries(CAPABILITY_KEYS.map((key) => [key, false])))

const MATCHERS = {
  bot: /bot|engine|stockfish/i,
  ranked: /ranked/i,
  rematch: /^rematch$/i,
  analysis: /^analysis$/i,
  history: /^history$/i,
  dailyPuzzle: /^daily[_-]?puzzle$/i,
  tournaments: /^tournaments?$/i,
}

/**
 * `home` is the `GET /` payload (or `null` while unknown); `fallback` the last remembered flags, used
 * only when there is no payload.
 */
export function resolveCapabilities(home, fallback = null) {
  if (!home) return { ...STATIC_CAPABILITIES, ...NONE, ...pick(fallback) }

  const flags = publishedFlags(home)
  const resolved = Object.fromEntries(
    CAPABILITY_KEYS.map((key) => [key, flags.some((flag) => MATCHERS[key].test(flag.id) && flag.on)]),
  )
  return { ...STATIC_CAPABILITIES, ...resolved }
}

/** Only known boolean flags survive from whatever was stored. */
function pick(stored) {
  if (!stored || typeof stored !== 'object') return {}
  return Object.fromEntries(CAPABILITY_KEYS.filter((key) => typeof stored[key] === 'boolean').map((key) => [key, stored[key]]))
}
