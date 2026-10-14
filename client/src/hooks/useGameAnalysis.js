import { useEffect, useState } from 'react'
import { gameApi } from '../lib/api'

// Stockfish passes are expensive — never re-run one for a PGN we already analysed this session.
const cache = new Map()

const IDLE = { status: 'idle', analysis: [], error: '' }
const UNAVAILABLE = { status: 'unavailable', analysis: [], error: '' }
const LOADING = { status: 'loading', analysis: [], error: '' }

/**
 * POSTs the PGN to `/api/game/analyze` and exposes a derived request state.
 * status: idle | loading | success | error | unavailable
 *
 * `unavailable` ("Coming Soon") means the backend does not offer analysis yet: either the caller passed
 * `enabled = false` (the server's home catalogue says `planned`) — in which case no request is made — or
 * the route answered 404.
 */
export function useGameAnalysis(pgn, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const [remote, setRemote] = useState({ key: null, status: 'idle', analysis: [], error: '' })

  const key = pgn ? `${attempt}:${pgn}` : null
  const useCache = attempt === 0 && Boolean(pgn) && cache.has(pgn)

  useEffect(() => {
    if (!pgn || !enabled || useCache) return undefined

    const controller = new AbortController()
    gameApi
      .analyze(pgn, controller.signal)
      .then((data) => {
        const analysis = Array.isArray(data?.analysis) ? data.analysis : []
        cache.set(pgn, analysis)
        setRemote({ key, status: 'success', analysis, error: '' })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        if (error.status === 404) {
          setRemote({ key, status: 'unavailable', analysis: [], error: '' })
          return
        }
        const busy = error.code === 'ENGINE_BUSY' || error.status === 503
        setRemote({
          key,
          status: 'error',
          analysis: [],
          error: busy ? 'The analysis engine is busy right now. Try again in a moment.' : error.message,
        })
      })

    return () => controller.abort()
  }, [pgn, key, enabled, useCache])

  let state = LOADING
  if (!pgn) state = IDLE
  else if (!enabled) state = UNAVAILABLE
  else if (remote.key === key) state = remote
  else if (useCache) state = { status: 'success', analysis: cache.get(pgn), error: '' }

  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
