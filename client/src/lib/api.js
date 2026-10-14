import { API_URL } from './config'
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

async function request(path, { method = 'GET', body, signal, auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = auth ? session.getToken() : null
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
    if (response.status === 401 && token && onUnauthorized) onUnauthorized()
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
}

/**
 * PvP: the server owns matchmaking. `create` either pairs us at once (`matchmaking.status: "matched"`,
 * 200) or queues us (`"searching"`, 202) — the match is then announced with the socket event
 * `game_started`. Moves/resign/draws go through REST; Socket.IO (`watch_game`) streams the results back.
 */
export const gamesApi = {
  create: (timeControl, signal) =>
    request('/api/games', { method: 'POST', body: { mode: 'pvp', time_control: timeControl }, signal }),
  cancelMatchmaking: (gameId, signal) => request(`/api/games/${gameId}/matchmaking`, { method: 'DELETE', signal }),
  get: (gameId, signal) => request(`/api/games/${gameId}`, { signal }),
  move: (gameId, move, signal) => request(`/api/games/${gameId}/moves`, { method: 'POST', body: move, signal }),
  resign: (gameId, signal) => request(`/api/games/${gameId}/resign`, { method: 'POST', signal }),
  listLive: (signal) => request('/api/games/live', { signal }),
  offerDraw: (gameId, signal) => request(`/api/games/${gameId}/draw-offers`, { method: 'POST', signal }),
  respondDraw: (gameId, decision, signal) =>
    request(`/api/games/${gameId}/draw-offers/response`, { method: 'POST', body: { decision }, signal }),
  claimDraw: (gameId, reason, signal) =>
    request(`/api/games/${gameId}/draw-claims`, { method: 'POST', body: { reason }, signal }),
}

/** `GET /` — player stats + the server's own catalogue of modes/features and their availability. */
export const homeApi = {
  get: (signal) => request('/', { signal }),
}

/** Not implemented by the server yet (`planned` in the home catalogue) — guarded by capabilities. */
export const gameApi = {
  analyze: (pgn, signal) => request('/api/game/analyze', { method: 'POST', body: { pgn }, signal }),
}
