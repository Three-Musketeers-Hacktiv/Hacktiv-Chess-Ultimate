import { Chess } from 'chess.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { gamesApi } from '../lib/api'
import { findCheckedKing, isPromotionMove, toMovetext } from '../lib/chess'
import { EVENTS } from '../lib/config'
import { lastGame } from '../lib/storage'

const NO_TARGETS = []
const FATAL_CODES = new Set(['GAME_NOT_FOUND', 'WATCH_FORBIDDEN', 'INVALID_ROOM_ID'])
const DRAW_ACK_MS = 5000

/** Immutable, render-friendly view of the mutable chess.js instance. */
function snapshotOf(chess) {
  const history = chess.history({ verbose: true })
  const last = history.at(-1)
  return {
    fen: chess.fen(),
    moves: history.map((m) => m.san),
    lastMove: last ? { from: last.from, to: last.to } : null,
    turn: chess.turn(),
    isCheck: chess.inCheck(),
    checkSquare: findCheckedKing(chess),
    // Draw claims are only worth offering when chess.js agrees (an invalid claim costs the claimant 2 min).
    claimable: { threefold: chess.isThreefoldRepetition(), fifty: chess.isDrawByFiftyMoves() },
  }
}

const withReceivedAt = (clocks) => (clocks ? { ...clocks, receivedAt: performance.now() } : null)

const outcomeFromState = (state) => ({
  status: 'completed',
  termination_reason: state.termination_reason,
  result: state.result,
  winner: state.result === '1-0' ? state.white : state.result === '0-1' ? state.black : null,
  ranked: Boolean(state.ranked),
  elo: state.elo ?? null, // `{ white|black: { before, change, after } }` — the booked rating movement
})

/**
 * Live match controller for the server's REST + Socket.IO contract.
 *
 * - Handshake: `watch_game` joins the room and answers with a `game_state` snapshot (re-sent on every
 *   (re)connect). Only running games can be watched — a queued room is refused (`WATCH_FORBIDDEN`),
 *   the lobby waits for `game_started` instead.
 * - Outbound: a move is validated by chess.js, applied optimistically, then POSTed. A rejected request
 *   rolls the optimistic move back.
 * - Inbound: the room broadcast (`move`, `game_over`) is applied idempotently by comparing ply counts, so
 *   the echo of our own move is ignored and a missed move triggers a PGN resync.
 * - All handlers are referentially stable so the memoised board never re-renders needlessly.
 */
export function useLiveGame({ socket, connected, roomId, me, meId }) {
  const [chess] = useState(() => new Chess())
  const [snap, setSnap] = useState(() => snapshotOf(chess))
  const [drawOffer, setDrawOffer] = useState(null) // username of whoever has an offer pending
  const [drawUnavailable, setDrawUnavailable] = useState(false) // backend never answered an offer
  const drawTimer = useRef(null)
  const [info, setInfo] = useState({
    loaded: false,
    white: null,
    black: null,
    status: 'waiting',
    timeControl: null,
    mode: 'pvp', // pvp | bot (bot games: we are White, Stockfish answers through the room's `move` event)
    botDifficulty: null,
    ranked: false, // rated PvP game: both ratings move when it ends
    elo: null, // `{ white|black: { before, change, after } }`; change/after are null until the game is over
  })
  const [clocks, setClocks] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [fatal, setFatal] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(null)
  const [pendingPromotion, setPendingPromotion] = useState(null)

  // Mirrors of state that event handlers need to read synchronously.
  const outcomeRef = useRef(null)
  const selectedRef = useRef(null)
  const pendingRef = useRef(null)
  const playableRef = useRef(false)
  const myColorRef = useRef(null)

  const myColor = useMemo(() => {
    if (!me) return null
    if (info.white && info.white.toLowerCase() === me.toLowerCase()) return 'w'
    if (info.black && info.black.toLowerCase() === me.toLowerCase()) return 'b'
    return null
  }, [info.white, info.black, me])

  const playable = info.status === 'in_progress' && !outcome && myColor !== null
  useEffect(() => {
    myColorRef.current = myColor
    playableRef.current = playable
  }, [myColor, playable])

  const select = useCallback((square) => {
    selectedRef.current = square
    setSelected(square)
  }, [])

  const setPending = useCallback((value) => {
    pendingRef.current = value
    setPendingPromotion(value)
  }, [])

  const refresh = useCallback(() => setSnap(snapshotOf(chess)), [chess])

  /** The server answered (or the game moved on): stop the "no response" countdown. */
  const ackDraw = useCallback(() => {
    clearTimeout(drawTimer.current)
    drawTimer.current = null
    setDrawUnavailable(false)
  }, [])
  useEffect(() => () => clearTimeout(drawTimer.current), [])

  /** Replace the local position with the server's authoritative PGN (fallback: bare FEN). */
  const resync = useCallback(
    (pgn, fen) => {
      try {
        chess.loadPgn(pgn)
      } catch {
        if (fen) chess.load(fen)
      }
      refresh()
      select(null)
    },
    [chess, refresh, select],
  )

  const finish = useCallback(
    (result) => {
      outcomeRef.current = result
      setOutcome(result)
      setInfo((prev) => ({ ...prev, status: 'completed', elo: result.elo ?? prev.elo }))
      setDrawOffer(null)
      ackDraw()
      select(null)
      setPending(null)
    },
    [select, setPending, ackDraw],
  )

  /* ───────── realtime inbound ───────── */
  useEffect(() => {
    if (!socket) return undefined

    const mine = (payload) => !payload?.room_id || payload.room_id === roomId

    const onState = (state) => {
      if (!mine(state)) return
      resync(state.pgn, state.fen)
      setClocks(withReceivedAt(state.clocks))
      setInfo({
        loaded: true,
        white: state.white ?? null,
        black: state.black ?? null,
        status: state.status,
        timeControl: state.time_control ?? null,
        mode: state.mode ?? 'pvp',
        botDifficulty: state.bot_difficulty ?? null,
        ranked: Boolean(state.ranked),
        elo: state.elo ?? null,
      })
      if (state.status === 'completed' && !outcomeRef.current) finish(outcomeFromState(state))

      const offerId = state.draw_offer_by_player_id
      if (!offerId || state.status !== 'in_progress') setDrawOffer(null)
      else if (offerId === meId) setDrawOffer(me)
      else setDrawOffer(state.white?.toLowerCase() === me?.toLowerCase() ? state.black : state.white)
    }

    const onDrawOffer = (payload) => {
      if (!mine(payload)) return
      ackDraw()
      setDrawOffer(payload.offered_by ?? 'Opponent')
    }

    const onDrawResponse = (payload) => {
      if (!mine(payload)) return
      ackDraw()
      setDrawOffer(null)
      if (payload.decision === 'decline') setNotice('The draw offer was declined.')
    }

    const onMove = (payload) => {
      if (!mine(payload)) return
      setDrawOffer(null) // the server drops a pending offer as soon as a move is played
      if (payload.clocks) setClocks(withReceivedAt(payload.clocks))
      if (payload.game_status) setInfo((prev) => ({ ...prev, status: payload.game_status }))

      const plies = payload.history?.length ?? chess.history().length
      const local = chess.history().length
      if (plies <= local) return // our own move echoed back, or a duplicate

      if (plies === local + 1 && payload.move) {
        try {
          chess.move({
            from: payload.move.from,
            to: payload.move.to,
            promotion: payload.move.promotion || undefined,
          })
          refresh()
          select(null)
          return
        } catch {
          /* fall through to a full resync */
        }
      }
      resync(payload.pgn, payload.fen)
    }

    const onGameOver = (payload) => {
      if (!mine(payload)) return
      if (payload.pgn) resync(payload.pgn)
      if (payload.clocks) setClocks(withReceivedAt({ ...payload.clocks, active_color: null }))
      finish(payload)
    }

    const onError = (payload) => {
      if (payload?.room_id && payload.room_id !== roomId) return
      if (FATAL_CODES.has(payload?.code)) setFatal(payload.message ?? 'This game is unavailable.')
      else setNotice(payload?.message ?? 'Something went wrong.')
    }

    socket.on(EVENTS.GAME_STATE, onState)
    socket.on(EVENTS.MOVE, onMove)
    socket.on(EVENTS.GAME_OVER, onGameOver)
    socket.on(EVENTS.GAME_ERROR, onError)
    socket.on(EVENTS.DRAW_OFFER, onDrawOffer)
    socket.on(EVENTS.DRAW_RESPONSE, onDrawResponse)
    return () => {
      socket.off(EVENTS.GAME_STATE, onState)
      socket.off(EVENTS.MOVE, onMove)
      socket.off(EVENTS.GAME_OVER, onGameOver)
      socket.off(EVENTS.GAME_ERROR, onError)
      socket.off(EVENTS.DRAW_OFFER, onDrawOffer)
      socket.off(EVENTS.DRAW_RESPONSE, onDrawResponse)
    }
  }, [socket, roomId, me, meId, chess, resync, refresh, select, finish, ackDraw])

  /* ───────── join the room (and re-join after every reconnect) ───────── */
  useEffect(() => {
    if (!socket || !connected) return
    socket.emit(EVENTS.WATCH_GAME, { room_id: roomId })
  }, [socket, connected, roomId])

  // Transient notices fade on their own.
  useEffect(() => {
    if (!notice) return undefined
    const id = setTimeout(() => setNotice(''), 4500)
    return () => clearTimeout(id)
  }, [notice])

  /* ───────── outbound ───────── */
  const commitMove = useCallback(
    (from, to, promotion) => {
      const color = myColorRef.current
      if (!playableRef.current || outcomeRef.current || chess.turn() !== color) return false

      const before = chess.history().length
      let played
      try {
        played = chess.move({ from, to, promotion })
      } catch {
        return false
      }
      refresh()
      select(null)

      const body = played.promotion ? { from, to, promotion: played.promotion } : { from, to }
      gamesApi
        .move(roomId, body)
        .then((res) => {
          if (res?.clocks) setClocks(withReceivedAt(res.clocks))
        })
        .catch((error) => {
          // Roll back only if the optimistic move is still the last one (no broadcast overwrote it).
          const history = chess.history()
          if (history.length === before + 1 && history.at(-1) === played.san) {
            chess.undo()
            refresh()
          }
          setNotice(error?.message ?? 'Move rejected.')
        })
      return true
    },
    [chess, roomId, refresh, select],
  )

  const attemptMove = useCallback(
    (from, to) => {
      if (!playableRef.current || chess.turn() !== myColorRef.current) return false
      if (isPromotionMove(chess, from, to)) {
        setPending({ from, to })
        return false // the board snaps back; the picker finishes the move
      }
      return commitMove(from, to)
    },
    [chess, commitMove, setPending],
  )

  const choosePromotion = useCallback(
    (piece) => {
      const pending = pendingRef.current
      setPending(null)
      if (pending) commitMove(pending.from, pending.to, piece)
    },
    [commitMove, setPending],
  )
  const cancelPromotion = useCallback(() => setPending(null), [setPending])

  const resign = useCallback(async () => {
    try {
      await gamesApi.resign(roomId) // the `game_over` broadcast finishes the UI
      return true
    } catch (error) {
      setNotice(error?.message ?? 'Could not resign.')
      return false
    }
  }, [roomId])

  /** Runs a draw REST call; the room broadcast (`draw_offer` / `draw_response` / `game_over`) updates the UI. */
  const draw = useCallback(
    async (call) => {
      try {
        await call()
        return true
      } catch (error) {
        setNotice(error?.message ?? 'Draw request failed.')
        return false
      }
    },
    [],
  )

  /**
   * Offer a draw (only while the game is live). If the backend neither answers the request nor broadcasts
   * `draw_offer` within DRAW_ACK_MS — or the route does not exist — the UI falls back to "Coming Soon".
   */
  const offerDraw = useCallback(async () => {
    if (!playableRef.current || outcomeRef.current) return false
    ackDraw()
    drawTimer.current = setTimeout(() => setDrawUnavailable(true), DRAW_ACK_MS)
    try {
      await gamesApi.offerDraw(roomId)
      ackDraw()
      setDrawOffer((current) => current ?? me) // the broadcast normally lands first; this covers a lagging socket
      return true
    } catch (error) {
      ackDraw()
      if (error?.status === 404 && !error?.code) setDrawUnavailable(true) // route missing, not "game not found"
      else setNotice(error?.message ?? 'Draw request failed.')
      return false
    }
  }, [roomId, me, ackDraw])

  const respondDraw = useCallback(
    async (decision) => {
      const ok = await draw(() => gamesApi.respondDraw(roomId, decision))
      if (!ok) setDrawOffer(null) // the offer is stale (already withdrawn / game moved on)
      return ok
    },
    [draw, roomId],
  )
  const claimDraw = useCallback((reason) => draw(() => gamesApi.claimDraw(roomId, reason)), [draw, roomId])

  /* ───────── board handlers (stable) ───────── */
  const canMove = useCallback(() => playableRef.current && chess.turn() === myColorRef.current, [chess])

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }) => (targetSquare ? attemptMove(sourceSquare, targetSquare) : false),
    [attemptMove],
  )

  const canDragPiece = useCallback(
    ({ piece }) => canMove() && piece.pieceType[0] === myColorRef.current,
    [canMove],
  )

  const onPieceDrag = useCallback(
    ({ square }) => {
      if (square && canMove()) select(square)
    },
    [canMove, select],
  )

  const onSquareClick = useCallback(
    ({ piece, square }) => {
      if (!canMove()) return
      const current = selectedRef.current

      if (current && current !== square) {
        const isLegalTarget = chess.moves({ square: current, verbose: true }).some((m) => m.to === square)
        if (isLegalTarget) {
          select(null)
          attemptMove(current, square)
          return
        }
      }

      if (piece && piece.pieceType[0] === myColorRef.current) select(current === square ? null : square)
      else select(null)
    },
    [chess, canMove, attemptMove, select],
  )

  /* ───────── derived ───────── */
  const legalTargets = useMemo(
    () =>
      selected
        ? chess.moves({ square: selected, verbose: true }).map((m) => ({ to: m.to, capture: Boolean(m.captured) }))
        : NO_TARGETS,
    // A selection is always cleared when the position changes, so `selected` alone is sufficient.
    [selected, chess],
  )

  const dismissNotice = useCallback(() => setNotice(''), [])

  const opponentName = myColor === 'w' ? info.black : myColor === 'b' ? info.white : null

  /* ───────── persistence for the post-game dashboard ───────── */
  useEffect(() => {
    if (!outcome || !myColor) return
    const clock = info.timeControl
    lastGame.set({
      gameId: roomId,
      pgn: toMovetext(chess.history()),
      color: myColor,
      me,
      opponent: opponentName ? { username: opponentName } : null,
      outcome,
      timeControl: typeof clock === 'string' ? clock : (clock?.id ?? null),
      ranked: Boolean(info.ranked),
      endedAt: new Date().toISOString(),
    })
  }, [outcome, snap.moves.length, chess, myColor, me, opponentName, roomId, info.timeControl, info.ranked])

  const getPgn = useCallback(() => toMovetext(chess.history()), [chess])

  return {
    ...snap,
    info,
    clocks,
    myColor,
    opponentName,
    fatal,
    notice,
    dismissNotice,
    selected,
    legalTargets,
    pendingPromotion,
    outcome,
    isMyTurn: playable && snap.turn === myColor,
    onPieceDrop,
    onPieceDrag,
    onSquareClick,
    canDragPiece,
    choosePromotion,
    cancelPromotion,
    resign,
    drawOffer,
    drawUnavailable,
    offerDraw,
    respondDraw,
    claimDraw,
    getPgn,
  }
}
