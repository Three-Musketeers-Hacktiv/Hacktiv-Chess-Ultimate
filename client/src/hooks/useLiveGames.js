import { useCallback, useEffect, useState } from 'react'
import { gamesApi } from '../lib/api'

const POLL_MS = 5000

/** Running PvP games (`GET /api/games/live`) — to spectate, or to rejoin one of your own. */
export function useLiveGames(enabled = true) {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (signal) => {
    try {
      const data = await gamesApi.listLive(signal)
      setGames(data?.games ?? [])
      setError('')
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err?.message ?? 'Could not load live games.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    const controller = new AbortController()
    load(controller.signal)
    const id = setInterval(() => {
      if (!document.hidden) load(controller.signal)
    }, POLL_MS)
    return () => {
      controller.abort()
      clearInterval(id)
    }
  }, [enabled, load])

  return { games, loading, error }
}
