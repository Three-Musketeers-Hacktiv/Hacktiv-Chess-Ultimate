import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gamesApi } from '../lib/api'
import { EVENTS } from '../lib/config'
import { unsupportedTimes } from '../lib/storage'
import { useAuth } from './useAuth'

const WATCH_POLL_MS = 2000

/**
 * Instant matchmaking on top of the server's room API.
 *
 * start(timeControl):
 *  1. join a rival's open room with that time control, else
 *  2. reuse one of our own open rooms with that time control, else
 *  3. create a room.
 * While a room of ours is waiting, the socket watches it (`watch_game`, re-sent every 2 s because the
 * server never announces a joiner). As soon as the snapshot says `in_progress` — or a `game_started`
 * event arrives — we navigate to `/arena/:id`; the arena then runs on the server's own clocks.
 *
 * cancel(): resets the UI at once and emits `leave_room` so a server that supports cancellation can drop
 * the room from its queue. The current server has no such listener (nor a delete route), so a room that
 * was already opened stays open until somebody joins it — `abandonedRoom` flags that case for the UI
 * ("Coming Soon" notice). The same best-effort `leave_room` is sent if the lobby unmounts mid-search.
 *
 * If the server answers a create request with a different time control than requested, that option is
 * remembered as unsupported ("Coming Soon").
 */
export function useMatchmaking({ socket, connected }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [phase, setPhase] = useState('idle') // idle | searching
  const [stage, setStage] = useState('lookup') // lookup | waiting
  const [searchingFor, setSearchingFor] = useState(null)
  const [roomId, setRoomId] = useState(null)
  const [error, setError] = useState('')
  const [abandonedRoom, setAbandonedRoom] = useState(false)
  const [unsupported, setUnsupported] = useState(unsupportedTimes.get)

  // Mirrors for callbacks / unmount cleanup that must read the latest values synchronously.
  const runRef = useRef(0)
  const roomRef = useRef(null)
  const timeRef = useRef(null)
  const socketRef = useRef(socket)
  const startedRef = useRef(false) // a game actually began → the room must NOT be left
  useEffect(() => {
    socketRef.current = socket
  }, [socket])

  const trackRoom = useCallback((id) => {
    roomRef.current = id
    setRoomId(id)
  }, [])

  /** Best-effort: tell a cancellation-aware server to drop our waiting room. Ignored by today's server. */
  const emitLeave = useCallback((id) => {
    if (!id) return
    socketRef.current?.emit(EVENTS.LEAVE_ROOM, { time_control: timeRef.current, room_id: id })
  }, [])

  const cancel = useCallback(() => {
    runRef.current += 1 // invalidates any in-flight start()
    const opened = roomRef.current
    emitLeave(opened)
    trackRoom(null)
    setPhase('idle')
    setStage('lookup')
    setSearchingFor(null)
    setAbandonedRoom(Boolean(opened))
  }, [emitLeave, trackRoom])

  const dismissAbandoned = useCallback(() => setAbandonedRoom(false), [])

  const start = useCallback(
    async (timeControl) => {
      const run = ++runRef.current
      const alive = () => runRef.current === run
      const me = user?.username?.toLowerCase()

      timeRef.current = timeControl
      startedRef.current = false
      setPhase('searching')
      setStage('lookup')
      setSearchingFor(timeControl)
      setAbandonedRoom(false)
      setError('')

      try {
        const open = await gamesApi.listOpen()
        if (!alive()) return
        const rooms = (open?.games ?? []).filter((room) => room.time_control === timeControl)

        // A rival is already waiting with the same time control → take the seat immediately.
        const rival = rooms.find((room) => room.white?.toLowerCase() !== me)
        if (rival) {
          try {
            const joined = await gamesApi.join(rival.id)
            startedRef.current = true
            navigate(`/arena/${joined.game.id}`) // we are seated now, even if the user just hit cancel
            return
          } catch {
            /* the room was taken in the meantime — fall through to our own room */
          }
        }
        if (!alive()) return

        // Otherwise wait in a room of ours (reuse an existing one instead of piling up new rooms).
        const own = rooms.find((room) => room.white?.toLowerCase() === me)
        if (own) {
          trackRoom(own.id)
          setStage('waiting')
          return
        }

        const created = await gamesApi.create(timeControl)
        const granted = created?.game?.time_control?.id
        if (granted && granted !== timeControl) setUnsupported(unsupportedTimes.add(timeControl))
        if (!alive()) {
          emitLeave(created?.game?.id) // cancelled while the room was being created
          return
        }
        trackRoom(created.game.id)
        setStage('waiting')
      } catch (err) {
        if (!alive()) return
        setError(err?.message ?? 'Matchmaking failed.')
        setPhase('idle')
        setSearchingFor(null)
      }
    },
    [user, navigate, trackRoom, emitLeave],
  )

  // Waiting in our own room: watch it until an opponent sits down.
  useEffect(() => {
    if (!socket || !connected || !roomId) return undefined

    const goArena = (id) => {
      startedRef.current = true
      navigate(`/arena/${id}`)
    }
    const onState = (state) => {
      if (state?.room_id === roomId && state.status === 'in_progress') goArena(roomId)
    }
    const onStarted = (payload) => goArena(payload?.room_id ?? roomId)
    const watch = () => socket.emit(EVENTS.WATCH_GAME, { room_id: roomId })

    socket.on(EVENTS.GAME_STATE, onState)
    socket.on(EVENTS.GAME_STARTED, onStarted)
    watch()
    const id = setInterval(watch, WATCH_POLL_MS)
    return () => {
      socket.off(EVENTS.GAME_STATE, onState)
      socket.off(EVENTS.GAME_STARTED, onStarted)
      clearInterval(id)
    }
  }, [socket, connected, roomId, navigate])

  // Leaving the lobby mid-search stops the search (and, unless a game began, leaves the room).
  useEffect(() => {
    return () => {
      runRef.current += 1
      if (roomRef.current && !startedRef.current) emitLeave(roomRef.current)
    }
  }, [emitLeave])

  return { phase, stage, searchingFor, error, unsupported, abandonedRoom, dismissAbandoned, start, cancel }
}
