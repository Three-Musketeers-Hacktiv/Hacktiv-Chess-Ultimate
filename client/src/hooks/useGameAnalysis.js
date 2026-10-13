import { useEffect, useState } from 'react'
import { gameApi } from '../lib/api'

// Stockfish passes are expensive — never re-run one for a PGN we already analysed this session.
const cache = new Map()

const IDLE = { status: 'idle', analysis: [], error: '' }
const LOADING = { status: 'loading', analysis: [], error: '' }

/**
 * POSTs the PGN to `/api/game/analyze` and exposes a derived request state.
 * status: idle | loading | success | error
 */
export function useGameAnalysis(pgn) {
  const [attempt, setAttempt] = useState(0)
  const [remote, setRemote] = useState({ key: null, status: 'idle', analysis: [], error: '' })

  const key = pgn ? `${attempt}:${pgn}` : null
  const useCache = attempt === 0 && Boolean(pgn) && cache.has(pgn)

  useEffect(() => {
    if (!pgn || useCache) return undefined

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
        const busy = error.code === 'ENGINE_BUSY' || error.status === 503
        setRemote({
          key,
          status: 'error',
          analysis: [],
          error: busy ? 'The analysis engine is busy right now. Try again in a moment.' : error.message,
        })
      })

    return () => controller.abort()
  }, [pgn, key, useCache])

  let state = LOADING
  if (!pgn) state = IDLE
  else if (remote.key === key) state = remote
  else if (useCache) state = { status: 'success', analysis: cache.get(pgn), error: '' }

  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
