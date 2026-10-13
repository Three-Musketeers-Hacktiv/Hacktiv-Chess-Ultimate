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

export const gameApi = {
  analyze: (pgn, signal) => request('/api/game/analyze', { method: 'POST', body: { pgn }, signal }),
}
