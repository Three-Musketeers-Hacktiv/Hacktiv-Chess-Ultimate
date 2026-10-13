import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BOT_DIFFICULTIES, EVENTS } from '../lib/config'
import { useSocket } from './useSocket'

const BOT_START_TIMEOUT_MS = 12_000

const isValidSession = (payload) =>
  Boolean(payload?.room_id) && (payload.color === 'w' || payload.color === 'b')

/**
 * Drives the lobby: enqueue (PvP) or start a bot match, then hop into the arena
 * the moment the server confirms with `game_started`.
 *
 * phase: idle | pvp | bot
 */
export function useMatchmaking() {
  const { socket, status, resetConnection } = useSocket()
  const navigate = useNavigate()
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const timeoutRef = useRef(null)

  const clearTimer = () => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = null
  }

  // Server confirmation → move to the arena. Registered once per socket instance.
  useEffect(() => {
    if (!socket) return undefined

    const onGameStarted = (payload) => {
      if (!isValidSession(payload)) {
        setPhase('idle')
        setError('The server sent an invalid match payload.')
        return
      }
      clearTimeout(timeoutRef.current)
      navigate(`/arena/${payload.room_id}`, { state: { session: payload } })
    }

    socket.on(EVENTS.GAME_STARTED, onGameStarted)
    return () => {
      socket.off(EVENTS.GAME_STARTED, onGameStarted)
      clearTimeout(timeoutRef.current)
    }
  }, [socket, navigate])

  const ensureReady = useCallback(() => {
    if (!socket || status !== 'connected') {
      setError('Realtime link is not ready yet. Give it a second and try again.')
      return false
    }
    setError('')
    return true
  }, [socket, status])

  const findMatch = useCallback(() => {
    if (!ensureReady()) return
    socket.emit(EVENTS.JOIN_ROOM)
    setPhase('pvp')
  }, [ensureReady, socket])

  const startBotMatch = useCallback(
    (difficulty = BOT_DIFFICULTIES.magnus.id) => {
      if (!ensureReady()) return
      socket.emit(EVENTS.START_BOT_MATCH, { difficulty })
      setPhase('bot')
      clearTimer()
      timeoutRef.current = setTimeout(() => {
        setPhase('idle')
        setError('The engine did not respond in time. Please try again.')
      }, BOT_START_TIMEOUT_MS)
    },
    [ensureReady, socket],
  )

  const cancel = useCallback(() => {
    clearTimer()
    resetConnection() // the contract has no "leave queue" event — a fresh transport drops us from it
    setPhase('idle')
  }, [resetConnection])

  return { phase, error, status, findMatch, startBotMatch, cancel }
}
