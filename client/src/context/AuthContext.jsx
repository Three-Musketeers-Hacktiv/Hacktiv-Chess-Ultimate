import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, authApi, setUnauthorizedHandler } from '../lib/api'
import { STORAGE_KEYS } from '../lib/config'
import { session } from '../lib/storage'
import { AuthContext } from './auth-context'

const readSession = () => ({ token: session.getToken(), user: session.getUser() })

/**
 * Owns identity only: JWT + user profile + the three auth actions.
 * Realtime concerns live in SocketContext so the two never re-render each other.
 */
export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readSession)

  const logout = useCallback(() => {
    session.clear()
    setAuth({ token: null, user: null })
  }, [])

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

  // An expired / revoked JWT detected by any request signs the user out globally.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

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
      isAuthenticated: Boolean(auth.token),
      login,
      register,
      logout,
    }),
    [auth, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
