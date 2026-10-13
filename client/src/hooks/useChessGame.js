import { Chess } from 'chess.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EVENTS } from '../lib/config'
import { findCheckedKing, isPromotionMove, toMovetext } from '../lib/chess'
import { lastGame } from '../lib/storage'

const NO_TARGETS = []

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
  }
}

/**
 * Live match controller.
 *
 * - chess.js is the local rules engine (legal-move gating, SAN, PGN) — the server stays the
 *   source of truth for results via `game_over`.
 * - Outgoing: validated locally, applied optimistically, then emitted through `move`.
 * - Incoming: opponent/bot `move` events are replayed onto the same instance. An echo of our own
 *   move is naturally rejected by chess.js (wrong side to move), so handling is idempotent.
 * - Every handler is referentially stable so the memoised board never re-renders needlessly.
 */
export function useChessGame({ socket, session, me }) {
  const myColor = session.color
  const [chess] = useState(() => new Chess())
  const [snap, setSnap] = useState(() => snapshotOf(chess))
  const [selected, setSelected] = useState(null)
  const [pendingPromotion, setPendingPromotion] = useState(null)
  const [outcome, setOutcome] = useState(null)

  // Mirrors of state that event handlers need to read synchronously.
  const outcomeRef = useRef(null)
  const selectedRef = useRef(null)
  const pendingRef = useRef(null)

  const select = useCallback((square) => {
    selectedRef.current = square
    setSelected(square)
  }, [])

  const setPending = useCallback((value) => {
    pendingRef.current = value
    setPendingPromotion(value)
  }, [])

  /* ───────── realtime inbound ───────── */
  useEffect(() => {
    if (!socket) return undefined

    const onMove = (payload) => {
      if (outcomeRef.current || !payload?.from || !payload?.to) return
      try {
        chess.move({ from: payload.from, to: payload.to, promotion: payload.promotion || undefined })
      } catch {
        return // echo of our own move, or a stale/duplicate event — ignore
      }
      setSnap(snapshotOf(chess))
      select(null)
    }

    const onGameOver = (payload) => {
      const result = payload ?? {}
      outcomeRef.current = result
      setOutcome(result)
      select(null)
      setPending(null)
    }

    socket.on(EVENTS.MOVE, onMove)
    socket.on(EVENTS.GAME_OVER, onGameOver)
    return () => {
      socket.off(EVENTS.MOVE, onMove)
      socket.off(EVENTS.GAME_OVER, onGameOver)
    }
  }, [socket, chess, select, setPending])

  /* ───────── outbound ───────── */
  const commitMove = useCallback(
    (from, to, promotion) => {
      if (outcomeRef.current || chess.turn() !== myColor || !socket?.connected) return false

      let move
      try {
        move = chess.move({ from, to, promotion })
      } catch {
        return false
      }

      socket.emit(EVENTS.MOVE, move.promotion ? { from, to, promotion: move.promotion } : { from, to })
      setSnap(snapshotOf(chess))
      select(null)
      return true
    },
    [chess, myColor, socket, select],
  )

  const attemptMove = useCallback(
    (from, to) => {
      if (outcomeRef.current || chess.turn() !== myColor) return false
      if (isPromotionMove(chess, from, to)) {
        setPending({ from, to })
        return false // the board snaps back; the picker finishes the move
      }
      return commitMove(from, to)
    },
    [chess, myColor, commitMove, setPending],
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

  /* ───────── board handlers (stable) ───────── */
  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }) => (targetSquare ? attemptMove(sourceSquare, targetSquare) : false),
    [attemptMove],
  )

  const canDragPiece = useCallback(
    ({ piece }) => !outcomeRef.current && piece.pieceType[0] === myColor && chess.turn() === myColor,
    [chess, myColor],
  )

  const onPieceDrag = useCallback(
    ({ square }) => {
      if (square && !outcomeRef.current && chess.turn() === myColor) select(square)
    },
    [chess, myColor, select],
  )

  const onSquareClick = useCallback(
    ({ piece, square }) => {
      if (outcomeRef.current || chess.turn() !== myColor) return
      const current = selectedRef.current

      if (current && current !== square) {
        const isLegalTarget = chess.moves({ square: current, verbose: true }).some((m) => m.to === square)
        if (isLegalTarget) {
          select(null)
          attemptMove(current, square)
          return
        }
      }

      if (piece && piece.pieceType[0] === myColor) select(current === square ? null : square)
      else select(null)
    },
    [chess, myColor, attemptMove, select],
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

  /* ───────── persistence for the post-game dashboard ───────── */
  useEffect(() => {
    if (!outcome) return
    lastGame.set({
      pgn: toMovetext(chess.history()),
      color: myColor,
      me,
      opponent: session.opponent ?? null,
      outcome,
      endedAt: new Date().toISOString(),
    })
  }, [outcome, snap.moves.length, chess, myColor, me, session.opponent])

  const getPgn = useCallback(() => toMovetext(chess.history()), [chess])

  return {
    ...snap,
    selected,
    legalTargets,
    pendingPromotion,
    outcome,
    isMyTurn: !outcome && snap.turn === myColor,
    onPieceDrop,
    onPieceDrag,
    onSquareClick,
    canDragPiece,
    choosePromotion,
    cancelPromotion,
    getPgn,
  }
}
