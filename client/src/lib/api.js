import { API_URL } from './config'
import { isTokenExpired } from './jwt'
import { session } from './storage'

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, details = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

let onUnauthorized = null

/** AuthContext registers a handler so an expired/invalid JWT logs the user out everywhere. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

function extractMessage(body, fallback) {
  if (!body) return fallback
  if (typeof body === 'string') return body
  if (Array.isArray(body.errors) && body.errors.length) {
    return body.errors.map((e) => e.message ?? e).join(' · ')
  }
  return body.message ?? body.error ?? fallback
}

async function request(path, { method = 'GET', body, signal, auth = true, logoutOn401 = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  // Every authenticated call reads the JWT fresh from storage → `Authorization: Bearer <token>`.
  const token = auth ? session.getToken() : null
  if (token && isTokenExpired(token)) {
    // Certainly dead: sign out locally instead of sending a request that can only answer 401.
    onUnauthorized?.()
    throw new ApiError('Your session has expired. Please sign in again.', { status: 401, code: 'TOKEN_EXPIRED' })
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('Cannot reach the server. Check your connection and try again.')
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && token && logoutOn401 && onUnauthorized) onUnauthorized()
    throw new ApiError(extractMessage(payload, `Request failed (${response.status})`), {
      status: response.status,
      code: payload?.code ?? null,
      details: payload,
    })
  }

  return payload
}

/* ───────────── Endpoints (see "API Documentation.md") ───────────── */

export const authApi = {
  register: ({ username, email, password }, signal) =>
    request('/api/auth/register', { method: 'POST', body: { username, email, password }, signal, auth: false }),
  login: ({ email, password }, signal) =>
    request('/api/auth/login', { method: 'POST', body: { email, password }, signal, auth: false }),
  /** Revokes the token server-side (and drops the user's sockets). Must run while the token is still stored. */
  logout: (signal) => request('/api/auth/logout', { method: 'POST', signal }),
}

/**
 * Rename the signed-in account. Password is a confirmation of the current one, not a new password.
 * A 401 here means the password was rejected, so it must not sign the user out (`logoutOn401: false`).
 */
export const userApi = {
  updateUsername: ({ username, password }, signal) =>
    request('/api/user/update-username', {
      method: 'PUT',
      body: { username, password },
      signal,
      logoutOn401: false,
    }),
}

/**
 * PvP: the server owns matchmaking. `create` either pairs us at once (`matchmaking.status: "matched"`,
 * 200) or queues us (`"searching"`, 202) — the match is then announced with the socket event
 * `game_started`. Moves/resign/draws go through REST; Socket.IO (`watch_game`) streams the results back.
 */
export const gamesApi = {
  create: (timeControl, signal) =>
    request('/api/games', { method: 'POST', body: { mode: 'pvp', time_control: timeControl }, signal }),
  /** Game vs Stockfish: starts at once (`201`), the player is White. `difficulty`: easy | medium | hard. */
  createBot: ({ timeControl, difficulty }, signal) =>
    request('/api/games', {
      method: 'POST',
      body: { mode: 'bot', time_control: timeControl, difficulty },
      signal,
    }),
  /** Stockfish review of a *finished* game (players only, ≤ 60 plies): `{ analysis: [{ ply, color, move, … }] }`. */
  analyze: (gameId, signal) => request(`/api/games/${gameId}/analysis`, { method: 'POST', signal }),
  /** Same review for any legal PGN / movetext (≤ 60 plies): `POST /api/game/analyze { pgn }`. */
  analyzePgn: (pgn, signal) => request('/api/game/analyze', { method: 'POST', body: { pgn }, signal }),
  cancelMatchmaking: (gameId, signal) => request(`/api/games/${gameId}/matchmaking`, { method: 'DELETE', signal }),
  get: (gameId, signal) => request(`/api/games/${gameId}`, { signal }),
  move: (gameId, move, signal) => request(`/api/games/${gameId}/moves`, { method: 'POST', body: move, signal }),
  resign: (gameId, signal) => request(`/api/games/${gameId}/resign`, { method: 'POST', signal }),
  listLive: (signal) => request('/api/games/live', { signal }),
  /** Personal game list (`limit` 1–50). Summaries only — PGN lives on `GET /api/games/:id` and `GET /api/profile/me`. */
  history: (limit, signal) => request(`/api/games?limit=${limit}`, { signal }),
  offerDraw: (gameId, signal) => request(`/api/games/${gameId}/draw-offers`, { method: 'POST', signal }),
  respondDraw: (gameId, decision, signal) =>
    request(`/api/games/${gameId}/draw-offers/response`, { method: 'POST', body: { decision }, signal }),
  claimDraw: (gameId, reason, signal) =>
    request(`/api/games/${gameId}/draw-claims`, { method: 'POST', body: { reason }, signal }),
}

/**
 * Rated/unrated PvP queue. `mode: 'ranked'` pairs players within ±200 Elo and the finished game moves both
 * ratings (K = 32). Same answers as `gamesApi.create` (200 matched / 202 searching) and the queue entry
 * is cancelled with `gamesApi.cancelMatchmaking`.
 */
export const matchmakingApi = {
  join: ({ mode, timeControl }, signal) =>
    request('/api/matchmaking/join', { method: 'POST', body: { mode, time_control: timeControl }, signal }),
}

/** `GET /` — player stats + the server's own catalogue of modes/features and their availability. */
export const homeApi = {
  get: (signal) => request('/', { signal }),
}

/** Signed-in profile: W/D/L totals plus up to 50 finished games with PGN. */
export const profileApi = {
  me: (signal) => request('/api/profile/me', { signal }),
}

/** One random tactic for the signed-in player. `difficulty` is easy, medium, or hard. */
export const puzzlesApi = {
  random: (difficulty, exclude, signal) => {
    const params = new URLSearchParams({ difficulty })
    if (exclude) params.set('exclude', exclude)
    return request(`/api/puzzles/random?${params}`, { signal })
  },
}
