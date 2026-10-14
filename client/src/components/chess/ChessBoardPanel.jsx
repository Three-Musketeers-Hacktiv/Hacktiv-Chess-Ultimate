import { memo, useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import { useTheme } from '../../hooks/useTheme'
import { findPieceSet } from '../../lib/board-presets'
import { CHESSBOARD_THEMES } from './boardThemes'
import { PIECE_TYPES, pieceUrl } from './pieceAssets'

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

const boardAssets = import.meta.glob('./assets/chess_boards/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

function makePieces(whiteColor, blackColor) {
  const pieces = {}

  for (const [side, color] of [['w', whiteColor], ['b', blackColor]]) {
    for (const piece of PIECE_TYPES) {
      const src = pieceUrl(color, piece)

      pieces[`${side}${piece}`] = () => (
        <img
          src={src}
          alt=""
          draggable={false}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
      )
    }
  }

  return pieces
}

const BOARD_OPTIONS_STATIC = {
  id: 'hcu-board',
  animationDurationInMs: 220,
  showAnimations: true,
  allowDragOffBoard: false,
  allowDrawingArrows: false,
  clearArrowsOnClick: false,
  dragActivationDistance: 4,
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
  whitePieceColor = null,
  blackPieceColor = null,
  boardTheme = null,
  fen,
  orientation = 'white',
  lastMove = null,
  checkSquare = null,
  selected = null,
  legalTargets = [],
  arrows = [],
  badge = null,
  interactive = false,
  onPieceDrop,
  onSquareClick,
  onPieceDrag,
  canDragPiece,
}) {
  const {
    boardTheme: { darkSquare, lightSquare, piecesType },
  } = useTheme()
  const pieceSet = findPieceSet(piecesType)
  const whiteColor = whitePieceColor ?? pieceSet.white
  const blackColor = blackPieceColor ?? pieceSet.black
  const pieces = useMemo(() => makePieces(whiteColor, blackColor), [whiteColor, blackColor])
  const theme = boardTheme ? CHESSBOARD_THEMES.find(({ id }) => id === boardTheme) : null
  if (boardTheme && !theme) throw new RangeError(`Unsupported chessboard theme: ${boardTheme}`)

  const boardImage = theme ? boardAssets[`./assets/chess_boards/${theme.asset}`] : null
  if (theme && !boardImage) throw new Error(`Missing chessboard asset: ${theme.asset}`)

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

  // `badge: { square, content }` draws `content` over that square's corner (react-chessboard v5 has no
  // `customSquareStyles`; `squareRenderer` is its hook for square decorations). The renderer re-creates what
  // the default one does — a full-size div carrying the square's highlight style around the piece.
  const squareRenderer = useMemo(() => {
    if (!badge) return undefined
    return function renderSquare({ square, children }) {
      return (
        <div style={{ position: 'relative', width: '100%', height: '100%', ...squareStyles[square] }}>
          {children}
          {square === badge.square && badge.content}
        </div>
      )
    }
  }, [badge, squareStyles])

  const options = useMemo(
    () => ({
      ...BOARD_OPTIONS_STATIC,
      pieces,
      boardStyle: {
        ...(theme && {
          backgroundImage: `url("${boardImage}")`,
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
        }),
        borderRadius: '0.7rem', // the wrapper no longer clips, so the board rounds its own corners
      },
      darkSquareStyle: { backgroundColor: theme ? 'transparent' : darkSquare },
      lightSquareStyle: { backgroundColor: theme ? 'transparent' : lightSquare },
      darkSquareNotationStyle: { color: theme ? theme.dark : lightSquare },
      lightSquareNotationStyle: { color: theme ? theme.light : darkSquare },
      position: fen,
      boardOrientation: orientation,
      squareStyles,
      squareRenderer,
      arrows,
      allowDragging: interactive,
      canDragPiece,
      onPieceDrop,
      onPieceDrag,
      onSquareClick,
    }),
    [
      fen,
      orientation,
      squareStyles,
      squareRenderer,
      arrows,
      interactive,
      canDragPiece,
      onPieceDrop,
      onPieceDrag,
      onSquareClick,
      pieces,
      boardImage,
      theme,
      darkSquare,
      lightSquare,
    ],
  )

  return (
    // `relative`, and no `overflow-hidden`/transform here: the drag preview must never be clipped or re-anchored.
    <div className="relative rounded-xl border border-slate-700/50 shadow-[0_0_40px_rgba(139,92,246,0.14)] ring-1 ring-black/40">
      <Chessboard options={options} />
    </div>
  )
})
