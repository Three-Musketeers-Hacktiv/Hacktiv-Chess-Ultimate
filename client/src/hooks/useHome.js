import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { homeApi } from '../lib/api'
import { resolveCapabilities } from '../lib/capabilities'
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

async function load(token) {
  if (snapshot.token === token) return // already loading / loaded for this session (StrictMode double effect)
  publish({ token, status: 'loading', home: null })
  try {
    const data = await homeApi.get()
    if (snapshot.token === token) publish({ token, status: 'ready', home: data?.home ?? null })
  } catch {
    if (snapshot.token === token) publish({ token, status: 'error', home: null })
  }
}

export function useHome() {
  const { token } = useAuth()
  const state = useSyncExternalStore(subscribe, getSnapshot)

  useEffect(() => {
    if (token && state.token !== token) load(token)
  }, [token, state.token])

  const current = state.token === token ? state : IDLE
  const capabilities = useMemo(() => resolveCapabilities(current.home), [current.home])

  return {
    status: current.status,
    home: current.home,
    stats: current.home?.stats ?? null,
    features: current.home?.features ?? [],
    capabilities,
  }
}
