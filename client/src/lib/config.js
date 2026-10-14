export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Socket.IO event names — single source of truth for the realtime contract (server/API.md). */
export const EVENTS = Object.freeze({
  // client → server
  WATCH_GAME: 'watch_game',
  LEAVE_ROOM: 'leave_room', // cancel matchmaking — not implemented by the server yet (ignored, best effort)
  REQUEST_REMATCH: 'request_rematch', // not implemented by the server yet — the UI degrades to "Coming Soon"
  // server → client: `game_started` is not emitted by the current server, but is accepted universally
  // (matchmaking also detects the start through the `game_state` snapshot).
  GAME_STARTED: 'game_started',
  // server → client: draw flow (REST starts it, the room broadcast tells both sides)
  DRAW_OFFER: 'draw_offer',
  DRAW_RESPONSE: 'draw_response',
  // server → client (rematch events are forward-looking: any of them proves the feature exists)
  REMATCH_PENDING: 'rematch_pending',
  REMATCH_STARTED: 'rematch_started',
  GAME_STATE: 'game_state',
  MOVE: 'move',
  GAME_OVER: 'game_over',
  GAME_ERROR: 'game_error',
})

/** Time-control presets accepted by `POST /api/games` (`time_control`). */
export const TIME_CONTROLS = Object.freeze([
  { id: 'bullet', label: 'Bullet', detail: '1 + 0' },
  { id: 'blitz', label: 'Blitz', detail: '3 + 2' },
  { id: 'rapid', label: 'Rapid', detail: '15 + 10' },
  { id: 'professional', label: 'Classical', detail: '60 + 30' },
])

export const timeControlLabel = (id) => {
  const preset = TIME_CONTROLS.find((tc) => tc.id === id)
  return preset ? `${preset.label} ${preset.detail}` : (id ?? '—')
}

/** Presentation data for the bot card. Availability comes from `GET /` (see `lib/capabilities.js`). */
export const BOT = Object.freeze({
  label: 'GM Magnus Carlsen',
  rating: 2882,
  blurb: 'Stockfish tuned to maximum strength.',
})

export const STORAGE_KEYS = Object.freeze({
  token: 'hcu.token',
  user: 'hcu.user',
  lastGame: 'hcu.lastGame',
  unsupportedTimes: 'hcu.unsupportedTimes',
})
