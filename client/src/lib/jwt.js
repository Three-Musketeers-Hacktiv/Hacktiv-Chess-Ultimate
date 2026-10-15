/**
 * Client-side peek at a JWT's `exp` claim. This is NOT verification (the server owns that) — it only lets
 * the app drop a token that is certainly dead instead of firing requests / socket handshakes that can
 * only answer 401.
 */

/** Expiry of the token as epoch milliseconds, or `null` when it cannot be read. */
export function tokenExpiry(token) {
  try {
    const payload = String(token).split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const { exp } = JSON.parse(atob(base64))
    return Number.isFinite(exp) ? exp * 1000 : null
  } catch {
    return null
  }
}

/** True only when the token carries an `exp` that has already passed (unreadable tokens are left to the server). */
export function isTokenExpired(token, now = Date.now()) {
  const expiry = tokenExpiry(token)
  return expiry !== null && expiry <= now
}
