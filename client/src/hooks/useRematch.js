import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EVENTS } from '../lib/config'

/** How long we wait for the server to acknowledge `request_rematch` before giving up. */
const ACK_TIMEOUT_MS = 6000

const OPEN_STATES = new Set(['requesting', 'waiting'])

/**
 * PvP rematch handshake over the socket (server/API.md → "Rematch PvP"), for the *finished* game `roomId`.
 *
 * status: idle | requesting | waiting | declined | error | unavailable | started
 *  - `request()` emits `request_rematch { room_id }`. If the opponent has not asked yet the server answers
 *    `rematch_requested` (→ `waiting`, "Waiting for opponent acceptance…"); if they already challenged us
 *    this call *is* the acceptance and `rematch_started` follows directly.
 *  - `rematch_pending` (the opponent challenges us) fills `challenge` → the accept/decline overlay.
 *  - `rematch_started` carries the NEW room id; we navigate there. `ArenaPage` keys its session by room id,
 *    so the board, clocks, orientation (colours are swapped) and move log are re-initialised from scratch.
 *  - `rematch_declined` / `rematch_error` end the wait without ever being fatal for the finished game.
 *
 * Every listener is removed on unmount, and leaving the arena while our own challenge is open withdraws it
 * (`decline_rematch`) so no game starts for a player who is gone.
 *
 * `supported` comes from the server's capability catalogue (`GET /`); while it is false nothing is sent and
 * the UI says "Coming Soon".
 */
export function useRematch({ socket, roomId, supported }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const [challenge, setChallenge] = useState(null) // { by } — the opponent's open challenge
  const [error, setError] = useState('')
  const statusRef = useRef('idle')
  const timer = useRef(null)

  const setPhase = useCallback((next) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const clearTimer = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    if (!socket) return undefined

    const onRequested = (payload) => {
      if (payload?.room_id !== roomId) return
      clearTimer()
      if (statusRef.current !== 'started') setPhase('waiting')
    }
    const onPending = (payload) => {
      if (payload?.room_id !== roomId) return
      setChallenge({ by: payload.requested_by ?? null })
    }
    const onStarted = (payload) => {
      if (payload?.previous_room_id !== roomId || !payload.room_id) return
      clearTimer()
      setChallenge(null)
      setPhase('started')
      navigate(`/arena/${payload.room_id}`, { replace: true })
    }
    const onDeclined = (payload) => {
      if (payload?.room_id !== roomId) return
      clearTimer()
      setChallenge(null)
      if (OPEN_STATES.has(statusRef.current)) setPhase('declined')
    }
    const onError = (payload) => {
      if (payload?.room_id && payload.room_id !== roomId) return
      if (payload?.code === 'REMATCH_ALREADY_STARTED') return // the started event is on its way
      clearTimer()
      setChallenge(null)
      setError(payload?.message ?? 'The rematch could not be started.')
      setPhase('error')
    }

    socket.on(EVENTS.REMATCH_REQUESTED, onRequested)
    socket.on(EVENTS.REMATCH_PENDING, onPending)
    socket.on(EVENTS.REMATCH_STARTED, onStarted)
    socket.on(EVENTS.REMATCH_DECLINED, onDeclined)
    socket.on(EVENTS.REMATCH_ERROR, onError)
    return () => {
      socket.off(EVENTS.REMATCH_REQUESTED, onRequested)
      socket.off(EVENTS.REMATCH_PENDING, onPending)
      socket.off(EVENTS.REMATCH_STARTED, onStarted)
      socket.off(EVENTS.REMATCH_DECLINED, onDeclined)
      socket.off(EVENTS.REMATCH_ERROR, onError)
      clearTimer()
    }
  }, [socket, roomId, navigate, clearTimer, setPhase])

  // Leaving the arena with our own challenge still open withdraws it.
  useEffect(
    () => () => {
      if (socket?.connected && OPEN_STATES.has(statusRef.current)) {
        socket.emit(EVENTS.DECLINE_REMATCH, { room_id: roomId })
      }
    },
    [socket, roomId],
  )

  const request = useCallback(() => {
    if (!supported) {
      setPhase('unavailable')
      return
    }
    if (!socket?.connected) {
      setError('Realtime connection lost. Reconnecting — try again in a moment.')
      setPhase('error')
      return
    }
    clearTimer()
    setChallenge(null) // answering an open challenge is the acceptance
    setError('')
    setPhase('requesting')
    socket.emit(EVENTS.REQUEST_REMATCH, { room_id: roomId })
    timer.current = setTimeout(() => {
      if (statusRef.current !== 'requesting') return
      setError('The server did not answer the rematch request.')
      setPhase('error')
    }, ACK_TIMEOUT_MS)
  }, [supported, socket, roomId, clearTimer, setPhase])

  const decline = useCallback(() => {
    setChallenge(null)
    if (socket?.connected) socket.emit(EVENTS.DECLINE_REMATCH, { room_id: roomId })
  }, [socket, roomId])

  const reset = useCallback(() => {
    setError('')
    setPhase('idle')
  }, [setPhase])

  return { status, challenge, error, request, decline, reset, supported }
}
