import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { STATIC_CAPABILITIES } from '../lib/capabilities'
import { EVENTS } from '../lib/config'

const ACK_TIMEOUT_MS = 2500

/**
 * Rematch request over the socket.
 *
 * The server has no `request_rematch` listener (verified in `server/`), so while
 * `STATIC_CAPABILITIES.rematch` is false the request is *not* sent: the UI goes straight to
 * `unavailable` ("Coming Soon"). Flip the flag and the full flow below is live:
 *
 * status: idle | requesting | waiting | unavailable
 * - `request_rematch` is emitted; no `rematch_pending` / `rematch_started` within ACK_TIMEOUT_MS →
 *   `unavailable`.
 * - `rematch_started` with a `room_id` moves both players straight into the new game.
 */
export function useRematch({ socket, roomId }) {
  const navigate = useNavigate()
  const [status, setStatus] = useState('idle')
  const timer = useRef(null)
  const supported = STATIC_CAPABILITIES.rematch

  const clearTimer = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    if (!socket || !supported) return undefined

    const onPending = () => {
      clearTimer()
      setStatus('waiting')
    }
    const onStarted = (payload) => {
      clearTimer()
      if (payload?.room_id) navigate(`/arena/${payload.room_id}`)
    }

    socket.on(EVENTS.REMATCH_PENDING, onPending)
    socket.on(EVENTS.REMATCH_STARTED, onStarted)
    return () => {
      socket.off(EVENTS.REMATCH_PENDING, onPending)
      socket.off(EVENTS.REMATCH_STARTED, onStarted)
      clearTimer()
    }
  }, [socket, supported, navigate, clearTimer])

  const request = useCallback(() => {
    if (!supported) {
      setStatus('unavailable')
      return
    }
    if (!socket?.connected) return
    setStatus('requesting')
    socket.emit(EVENTS.REQUEST_REMATCH, { room_id: roomId })
    clearTimer()
    timer.current = setTimeout(() => setStatus('unavailable'), ACK_TIMEOUT_MS)
  }, [supported, socket, roomId, clearTimer])

  const reset = useCallback(() => setStatus('idle'), [])

  return { status, request, reset, supported }
}
