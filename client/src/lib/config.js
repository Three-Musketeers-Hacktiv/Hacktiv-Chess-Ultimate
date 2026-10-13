export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')

/** Socket.IO event names — single source of truth for the realtime contract. */
export const EVENTS = Object.freeze({
  JOIN_ROOM: 'join_room',
  START_BOT_MATCH: 'start_bot_match',
  GAME_STARTED: 'game_started',
  MOVE: 'move',
  GAME_OVER: 'game_over',
})

/** Bot presets sent through `start_bot_match`. The contract currently ships a single level. */
export const BOT_DIFFICULTIES = Object.freeze({
  magnus: {
    id: 'magnus',
    label: 'GM Magnus Carlsen',
    rating: 2882,
    blurb: 'Stockfish tuned to maximum strength.',
  },
})

export const STORAGE_KEYS = Object.freeze({
  token: 'hcu.token',
  user: 'hcu.user',
  lastGame: 'hcu.lastGame',
})
