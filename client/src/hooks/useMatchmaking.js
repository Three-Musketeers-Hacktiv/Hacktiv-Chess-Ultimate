import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gamesApi, matchmakingApi } from '../lib/api'
import { EVENTS } from '../lib/config'
import { queue, unsupportedTimes } from '../lib/storage'

const STATUS_POLL_MS = 3000

/**
 * Instant matchmaking on top of the server-side queue.
 *
 * start(timeControl, mode = 'casual')
 *   casual → `POST /api/games { mode: 'pvp', time_control }`
 *   ranked → `POST /api/matchmaking/join { mode: 'ranked', time_control }` (rated game, rivals within ±200 Elo)
 *   Both answer the same way:
 *   • 200 `matched`   → an opponent was waiting (or we already had a running game): go to `/arena/:id`.
 *   • 202 `searching` → we are queued. The server announces the pairing with a private `game_started`
 *                       socket event; a light `GET /api/games/:id` poll covers a missed event/reconnect.
 *
 * cancel() → resets the UI at once, then `DELETE /api/games/:id/matchmaking`. If somebody paired with
 *   us in the meantime the server answers `409 MATCH_ALREADY_FOUND` and we go straight to that game.
 *
 * The server has no "my queue" lookup, so the queue entry we created is remembered (`lib/storage`):
 * after a page reload the search resumes (or the game opens) instead of leaving a ghost queue behind.
 * Leaving the lobby mid-search cancels the queue entry.
 */
export function useMatchmaking({ socket }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('idle') // idle | searching
  const [stage, setStage] = useState('lookup') // lookup (request in flight) | waiting (queued)
  const [searchingFor, setSearchingFor] = useState(null)
  const [searchingMode, setSearchingMode] = useState('casual') // casual | ranked
  const [roomId, setRoomId] = useState(null)
  const [error, setError] = useState('')
  const [unsupported, setUnsupported] = useState(unsupportedTimes.get)

  // Mirrors for callbacks / unmount cleanup that must read the latest values synchronously.
  const runRef = useRef(0)
  const roomRef = useRef(null)
  const startedRef = useRef(false) // a game actually began → the queue entry must NOT be cancelled

  const trackRoom = useCallback((id) => {
    roomRef.current = id
    setRoomId(id)
  }, [])

  const showIdle = useCallback(() => {
    trackRoom(null)
    setPhase('idle')
    setStage('lookup')
    setSearchingFor(null)
    setSearchingMode('casual')
  }, [trackRoom])

  const goArena = useCallback(
    (id) => {
      startedRef.current = true
      queue.clear()
      navigate(`/arena/${id}`)
    },
    [navigate],
  )

  /** Remove our queue entry on the server; a paired game wins over the cancellation. */
  const dropQueue = useCallback(
    async (id) => {
      try {
        await gamesApi.cancelMatchmaking(id)
        queue.clear()
      } catch (err) {
        if (err?.code === 'MATCH_ALREADY_FOUND') goArena(id)
        else if (err?.status === 404) queue.clear() // already gone
        else setError(err?.message ?? 'Could not cancel the search.')
      }
    },
    [goArena],
  )

  const cancel = useCallback(() => {
    runRef.current += 1 // invalidates any in-flight start()
    const queued = roomRef.current
    showIdle()
    if (queued) dropQueue(queued)
  }, [showIdle, dropQueue])

  const start = useCallback(
    async (timeControl, mode = 'casual') => {
      const run = ++runRef.current
      const alive = () => runRef.current === run

      startedRef.current = false
      setPhase('searching')
      setStage('lookup')
      setSearchingFor(timeControl)
      setSearchingMode(mode)
      setError('')

      try {
        const res =
          mode === 'ranked'
            ? await matchmakingApi.join({ mode, timeControl })
            : await gamesApi.create(timeControl)
        const game = res?.game
        const granted = game?.time_control?.id
        if (granted && granted !== timeControl) setUnsupported(unsupportedTimes.add(timeControl))

        // Paired at once — we are seated now, even if the user just hit cancel.
        if (res?.matchmaking?.status === 'matched') {
          goArena(game.id)
          return
        }

        queue.set({ id: game.id, time_control: timeControl, mode })
        if (!alive()) {
          dropQueue(game.id) // cancelled while the request was in flight
          return
        }
        trackRoom(game.id)
        setStage('waiting')
      } catch (err) {
        if (!alive()) return
        if (err?.code === 'INVALID_TIME_CONTROL') setUnsupported(unsupportedTimes.add(timeControl))
        setError(err?.message ?? 'Matchmaking failed.')
        showIdle()
      }
    },
    [goArena, dropQueue, trackRoom, showIdle],
  )

  // Page reload while queued → resume the search (or open the game if we were paired meanwhile).
  useEffect(() => {
    const saved = queue.get()
    if (!saved?.id) return undefined
    let stopped = false

    gamesApi
      .get(saved.id)
      .then((res) => {
        if (stopped) return
        const status = res?.game?.status
        if (status === 'waiting') {
          setSearchingFor(saved.time_control ?? null)
          setSearchingMode(saved.mode === 'ranked' ? 'ranked' : 'casual')
          setPhase('searching')
          setStage('waiting')
          trackRoom(saved.id)
        } else if (status === 'in_progress') {
          goArena(saved.id)
        } else {
          queue.clear()
        }
      })
      .catch((err) => {
        if (!stopped && (err?.status === 404 || err?.status === 403)) queue.clear()
      })

    return () => {
      stopped = true
    }
  }, [goArena, trackRoom])

  // Queued: wait for `game_started`; poll the game as a safety net (missed event / reconnect).
  useEffect(() => {
    if (!roomId) return undefined
    let stopped = false

    const onStarted = (payload) => {
      if (!payload?.room_id || payload.room_id === roomId) goArena(payload?.room_id ?? roomId)
    }
    socket?.on(EVENTS.GAME_STARTED, onStarted)

    const check = async () => {
      try {
        const res = await gamesApi.get(roomId)
        if (stopped) return
        if (res?.game?.status === 'in_progress') goArena(roomId)
      } catch (err) {
        // The entry vanished (cancelled from another tab/device) → back to the menu.
        if (!stopped && err?.status === 404) {
          queue.clear()
          showIdle()
        }
      }
    }
    const id = setInterval(check, STATUS_POLL_MS)

    return () => {
      stopped = true
      socket?.off(EVENTS.GAME_STARTED, onStarted)
      clearInterval(id)
    }
  }, [socket, roomId, goArena, showIdle])

  // Leaving the lobby mid-search stops the search (unless a game began).
  useEffect(() => {
    return () => {
      runRef.current += 1
      if (roomRef.current && !startedRef.current) dropQueue(roomRef.current)
    }
  }, [dropQueue])

  return { phase, stage, searchingFor, searchingMode, error, unsupported, start, cancel }
}
