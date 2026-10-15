import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, authApi, setUnauthorizedHandler } from '../lib/api'
import { STORAGE_KEYS } from '../lib/config'
import { isTokenExpired, tokenExpiry } from '../lib/jwt'
import { session } from '../lib/storage'
import { AuthContext } from './auth-context'

const MAX_TIMER_MS = 2 ** 31 - 1 // setTimeout overflows (fires at once) beyond this

/** The stored session — a token whose `exp` has passed is treated as "not signed in" and wiped. */
const readSession = () => {
  const token = session.getToken()
  if (token && isTokenExpired(token)) {
    session.clear()
    return { token: null, user: null }
  }
  return { token, user: session.getUser() }
}

/**
 * Owns identity only: JWT + user profile + the three auth actions.
 * Realtime concerns live in SocketContext so the two never re-render each other.
 */
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readSession)

  /** Local sign-out only (no request): used when the server already told us the token is dead. */
  const clearSession = useCallback(() => {
    session.clear()
    setAuth({ token: null, user: null })
  }, [])

  /** User-initiated sign-out: revoke the token on the server first (best effort), then forget it locally. */
  const logout = useCallback(() => {
    if (session.getToken()) authApi.logout().catch(() => {}) // the request is built synchronously, before the token is cleared
    clearSession()
  }, [clearSession])

  const login = useCallback(async ({ email, password }, signal) => {
    const data = await authApi.login({ email, password }, signal)
    if (!data?.token || !data?.user) {
      throw new ApiError('The server returned an unexpected response.')
    }
    session.save(data.token, data.user)
    setAuth({ token: data.token, user: data.user })
    return data.user
  }, [])

  const register = useCallback((payload, signal) => authApi.register(payload, signal), [])

  /** Merge a profile change into the signed-in user (and swap the JWT if the server re-issued one). */
  const updateUser = useCallback((patch, nextToken) => {
    setAuth((prev) => {
      if (!prev.user) return prev
      const token = typeof nextToken === 'string' && nextToken ? nextToken : prev.token
      const user = { ...prev.user, ...patch }
      session.save(token, user)
      return { token, user }
    })
  }, [])

  // An expired / revoked JWT detected by any request signs the user out globally.
  useEffect(() => {
    setUnauthorizedHandler(clearSession)
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  // Sign out the moment the JWT expires, so a long-open tab never keeps a dead token (or socket) alive.
  useEffect(() => {
    const expiry = auth.token ? tokenExpiry(auth.token) : null
    if (expiry === null) return undefined
    const id = setTimeout(clearSession, Math.min(Math.max(expiry - Date.now(), 0), MAX_TIMER_MS))
    return () => clearTimeout(id)
  }, [auth.token, clearSession])

  // Keep multiple tabs in sync (login in one, logout in another).
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEYS.token || event.key === STORAGE_KEYS.user || event.key === null) {
        setAuth(readSession())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({
      token: auth.token,
      user: auth.user,
      // A session needs both halves: a (non-expired, see readSession) token and the user it belongs to.
      isAuthenticated: Boolean(auth.token && auth.user),
      login,
      register,
      logout,
      updateUser,
      expireSession: clearSession,
    }),
    [auth, login, register, logout, updateUser, clearSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
