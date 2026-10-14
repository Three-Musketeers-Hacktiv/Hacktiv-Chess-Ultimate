import { memo, useMemo } from 'react'
import { Chessboard } from 'react-chessboard'

const LIGHT = { backgroundColor: '#a9b3c9' }
const DARK = { backgroundColor: '#4a5876' }

const lastMoveStyle = { backgroundColor: 'rgba(16, 185, 129, 0.32)' }
const selectedStyle = { backgroundColor: 'rgba(139, 92, 246, 0.55)' }
const moveDot = { backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.85) 0 18%, transparent 20%)' }
const captureRing = { backgroundImage: 'radial-gradient(circle, transparent 0 60%, rgba(16,185,129,0.85) 62% 78%, transparent 80%)' }
const checkStyle = {
  backgroundImage: 'radial-gradient(circle, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.45) 45%, transparent 75%)',
}

const NOTATION = {
  position: 'absolute',
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  fontWeight: 600,
  userSelect: 'none',
}

const BOARD_OPTIONS_STATIC = {
  id: 'hcu-board',
  darkSquareStyle: DARK,
  lightSquareStyle: LIGHT,
  animationDurationInMs: 220,
  showAnimations: true,
  allowDragOffBoard: false,
  allowDrawingArrows: false,
  clearArrowsOnClick: false,
  dragActivationDistance: 4,
  darkSquareNotationStyle: { color: '#cbd5e1' },
  lightSquareNotationStyle: { color: '#475569' },
  alphaNotationStyle: { ...NOTATION, bottom: 2, right: 5 },
  numericNotationStyle: { ...NOTATION, top: 3, left: 4 },
  dropSquareStyle: { boxShadow: 'inset 0 0 0 3px rgba(139, 92, 246, 0.85)' },
}

/**
 * Pure presentational board. Memoised: it only re-renders when the position,
 * highlights or callbacks (which the game hook keeps referentially stable) change —
 * clock ticks, chat, connection flaps etc. never touch it.
 */
export const ChessBoardPanel = memo(function ChessBoardPanel({
  fen,
  orientation = 'white',
  lastMove = null,
  checkSquare = null,
  selected = null,
  legalTargets = [],
  arrows = [],
  interactive = false,
  onPieceDrop,
  onSquareClick,
  onPieceDrag,
  canDragPiece,
}) {
  const squareStyles = useMemo(() => {
    const styles = {}
    if (lastMove) {
      styles[lastMove.from] = lastMoveStyle
      styles[lastMove.to] = lastMoveStyle
    }
    if (checkSquare) styles[checkSquare] = checkStyle
    if (selected) styles[selected] = selectedStyle
    for (const { to, capture } of legalTargets) {
      styles[to] = { ...(styles[to] ?? {}), ...(capture ? captureRing : moveDot), cursor: 'pointer' }
    }
    return styles
  }, [lastMove, checkSquare, selected, legalTargets])

  const options = useMemo(
    () => ({
      ...BOARD_OPTIONS_STATIC,
      position: fen,
      boardOrientation: orientation,
      squareStyles,
      arrows,
      allowDragging: interactive,
      canDragPiece,
      onPieceDrop,
      onPieceDrag,
      onSquareClick,
    }),
    [fen, orientation, squareStyles, arrows, interactive, canDragPiece, onPieceDrop, onPieceDrag, onSquareClick],
  )

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/50 shadow-[0_0_40px_rgba(139,92,246,0.14)] ring-1 ring-black/40">
      <Chessboard options={options} />
    </div>
  )
})
