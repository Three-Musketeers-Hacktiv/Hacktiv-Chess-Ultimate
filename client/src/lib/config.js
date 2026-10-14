export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Socket.IO event names — single source of truth for the realtime contract (server/API.md). */
export const EVENTS = Object.freeze({
  // client → server
  WATCH_GAME: 'watch_game',
  REQUEST_REMATCH: 'request_rematch', // `{ room_id }` — first call challenges, the opponent's call accepts
  DECLINE_REMATCH: 'decline_rematch', // `{ room_id }` — decline a challenge, or withdraw our own
  // server → client: private match announcement `{ room_id, color, opponent, game }`
  GAME_STARTED: 'game_started',
  // server → client: draw flow (REST starts it, the room broadcast tells both sides)
  DRAW_OFFER: 'draw_offer',
  DRAW_RESPONSE: 'draw_response',
  // server → client: rematch handshake (private `user:<id>` room; the old game room is no longer watched)
  REMATCH_REQUESTED: 'rematch_requested', // ack to the challenger `{ room_id }`
  REMATCH_PENDING: 'rematch_pending', // to the opponent `{ room_id, requested_by }`
  REMATCH_STARTED: 'rematch_started', // to both `{ room_id (new), previous_room_id, color, opponent, game }`
  REMATCH_DECLINED: 'rematch_declined', // `{ room_id, declined_by }`
  REMATCH_ERROR: 'rematch_error', // `{ code, message, room_id }` (never fatal, unlike `game_error`)
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
  label: 'Stockfish',
  blurb: 'Face the engine at the strength you pick. You play White; every clock is kept by the server.',
})

/** Accepted by `POST /api/games` (`difficulty`) for `mode: 'bot'`. */
export const BOT_DIFFICULTIES = Object.freeze([
  { id: 'easy', label: 'Easy', detail: 'Relaxed' },
  { id: 'medium', label: 'Medium', detail: 'Club level' },
  { id: 'hard', label: 'Hard', detail: 'No mercy' },
])

/** Longest game (in half-moves) the server will analyse (`ANALYSIS_GAME_TOO_LONG` above this). */
export const MAX_ANALYZED_PLIES = 60

export const STORAGE_KEYS = Object.freeze({
  token: 'hcu.token',
  user: 'hcu.user',
  lastGame: 'hcu.lastGame',
  // v2: entries recorded against the old server (which ignored presets) must not lock options any more.
  unsupportedTimes: 'hcu.unsupportedTimes.v2',
  legacyUnsupportedTimes: 'hcu.unsupportedTimes',
  queue: 'hcu.queue',
  capabilities: 'hcu.capabilities',
  globalTheme: 'hcu.globalTheme',
  legacyBoardTheme: 'hcu.boardTheme',
})
