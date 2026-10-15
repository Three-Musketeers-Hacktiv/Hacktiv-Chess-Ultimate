import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { homeApi } from '../lib/api'
import { resolveCapabilities } from '../lib/capabilities'
import { capabilityCache } from '../lib/storage'
import { useAuth } from './useAuth'

/**
 * Tiny shared store for `GET /` (stats + feature catalogue). One request per signed-in session,
 * shared by every component that needs it (lobby, analysis, …).
 */
const IDLE = { token: null, status: 'idle', home: null }
let snapshot = IDLE
const listeners = new Set()

const publish = (next) => {
  snapshot = next
  listeners.forEach((listener) => listener())
}
const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const getSnapshot = () => snapshot

/** Remember the server's latest feature flags so a reload/outage does not re-lock the menus. */
const remember = (home) => {
  if (home) capabilityCache.set(resolveCapabilities(home))
}

async function load(token) {
  if (snapshot.token === token) return // already loading / loaded for this session (StrictMode double effect)
  publish({ token, status: 'loading', home: null })
  try {
    const data = await homeApi.get()
    remember(data?.home)
    if (snapshot.token === token) publish({ token, status: 'ready', home: data?.home ?? null })
  } catch {
    if (snapshot.token === token) publish({ token, status: 'error', home: null })
  }
}

/** Silent re-fetch (ratings and stats move after every game); the previous data stays on screen meanwhile. */
async function reload(token) {
  if (snapshot.token !== token || snapshot.status === 'loading') return
  try {
    const data = await homeApi.get()
    remember(data?.home)
    if (snapshot.token === token) publish({ token, status: 'ready', home: data?.home ?? snapshot.home })
  } catch {
    /* keep showing what we have */
  }
}

export function useHome() {
  const { token } = useAuth()
  const state = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    if (token && state.token !== token) load(token)
  }, [token, state.token])

  const current = state.token === token ? state : IDLE
  // Without an answer (loading, or the request failed) the last remembered flags apply.
  const capabilities = useMemo(
    () => resolveCapabilities(current.home, capabilityCache.get()),
    [current.home],
  )
  const refresh = useCallback(() => {
    if (token) reload(token)
  }, [token])

  return {
    status: current.status,
    home: current.home,
    user: current.home?.user ?? null,
    /** Current Elo rating (`null` until `GET /` answers, or on a server without ratings). */
    elo: current.home?.user?.elo_rating ?? null,
    refresh,
    stats: current.home?.stats ?? null,
    features: current.home?.features ?? [],
    capabilities,
  }
}
