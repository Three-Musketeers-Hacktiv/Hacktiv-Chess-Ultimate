import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gamesApi } from '../lib/api'

/**
 * Starts a game against Stockfish: `POST /api/games { mode: 'bot', time_control, difficulty }`.
 * Unlike PvP there is no queue — the server answers `201` with a running game and we go straight to
 * `/arena/:id`. Stockfish's replies then arrive as ordinary `move` events of that room.
 *
 * Errors worth knowing: `503 ENGINE_UNAVAILABLE` (STOCKFISH_PATH not configured), `409` while another PvP
 * game is still running. The server's own message is surfaced as `error`.
 */
export function useBotGame() {
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const start = useCallback(
    async ({ timeControl, difficulty }) => {
      setStarting(true)
      setError('')
      try {
        const res = await gamesApi.createBot({ timeControl, difficulty })
        navigate(`/arena/${res.game.id}`)
      } catch (err) {
        if (!mounted.current) return
        setError(
          err?.code === 'ENGINE_UNAVAILABLE'
            ? 'Stockfish is not configured on the server yet (STOCKFISH_PATH). Ask the backend team to enable it.'
            : (err?.message ?? 'Could not start the game.'),
        )
      } finally {
        if (mounted.current) setStarting(false)
      }
    },
    [navigate],
  )

  const dismissError = useCallback(() => setError(''), [])

  return { starting, error, start, dismissError }
}
