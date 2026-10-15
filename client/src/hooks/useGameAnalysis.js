import { useEffect, useState } from 'react'
import { gamesApi } from '../lib/api'

// Stockfish passes are expensive — never re-run one for a game we already analysed this session.
const cache = new Map()

const IDLE = { status: 'idle', analysis: [], error: '' }
const UNAVAILABLE = { status: 'unavailable', analysis: [], error: '' }
const LOADING = { status: 'loading', analysis: [], error: '' }

/** Engine-side conditions that mean "no analysis for you right now" rather than a transient failure. */
const UNAVAILABLE_CODES = new Set(['ENGINE_UNAVAILABLE'])

function describeError(error) {
  if (error.code === 'ENGINE_BUSY' || error.status === 503) {
    return 'The analysis engine is busy right now. Try again in a moment.'
  }
  return error.message
}

/**
 * Stockfish review of a game and a derived request state.
 * status: idle | loading | success | error | unavailable
 *
 * The finished game's PGN goes to `POST /api/game/analyze { pgn }`; without a PGN the stored game is
 * analysed by id (`POST /api/games/:id/analysis`). The request fires as soon as the page mounts.
 *
 * `unavailable` means no request is (or can be) made: the caller passed `enabled = false` (e.g. the game
 * is too long for the engine) or the server reported its engine as not available (`ENGINE_UNAVAILABLE`).
 */
export function useGameAnalysis({ pgn, gameId }, enabled = true) {
  const [attempt, setAttempt] = useState(0)
  const [remote, setRemote] = useState({ key: null, status: 'idle', analysis: [], error: '' })

  const subject = pgn || gameId || null
  const key = subject ? `${attempt}:${subject}` : null
  const useCache = attempt === 0 && Boolean(subject) && cache.has(subject)

  useEffect(() => {
    if (!subject || !enabled || useCache) return undefined

    const controller = new AbortController()
    const call = pgn
      ? gamesApi.analyzePgn(pgn, controller.signal)
      : gamesApi.analyze(gameId, controller.signal)
    call
      .then((data) => {
        const analysis = Array.isArray(data?.analysis) ? data.analysis : []
        cache.set(subject, analysis)
        setRemote({ key, status: 'success', analysis, error: '' })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        if (UNAVAILABLE_CODES.has(error.code)) {
          setRemote({ key, status: 'unavailable', analysis: [], error: '' })
          return
        }
        setRemote({ key, status: 'error', analysis: [], error: describeError(error) })
      })

    return () => controller.abort()
  }, [subject, pgn, gameId, key, enabled, useCache])

  let state = LOADING
  if (!subject) state = IDLE
  else if (!enabled) state = UNAVAILABLE
  else if (remote.key === key) state = remote
  else if (useCache) state = { status: 'success', analysis: cache.get(subject), error: '' }

  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
