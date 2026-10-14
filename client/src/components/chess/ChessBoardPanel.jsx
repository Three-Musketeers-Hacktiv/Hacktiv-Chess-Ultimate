import { memo, useMemo } from 'react'
import { Chessboard } from 'react-chessboard'
import { CHESSBOARD_THEMES } from './boardThemes'

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

const pieceAssets = import.meta.glob('./assets/chess_pieces/**/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const boardAssets = import.meta.glob('./assets/chess_boards/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const colorCode = {
  white: 'l',
  black: 'd',
  blue: 'b',
  green: 'g',
  red: 'r',
  yellow: 'y',
}

const pieceCode = {
  K: 'k',
  Q: 'q',
  R: 'r',
  B: 'b',
  N: 'n',
  P: 'p',
}

function makePieces(whiteColor, blackColor) {
  const pieces = {}

  for (const [side, color] of [['w', whiteColor], ['b', blackColor]]) {
    const colorLetter = colorCode[color]
    if (!colorLetter) throw new RangeError(`Unsupported chess piece color: ${color}`)

    for (const [piece, pieceLetter] of Object.entries(pieceCode)) {
      const path =
        `./assets/chess_pieces/${color}/Chess_` +
        `${pieceLetter}${colorLetter}t45.svg`
      const src = pieceAssets[path]
      if (!src) throw new Error(`Missing chess piece asset: ${path}`)

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
  whitePieceColor = 'white',
  blackPieceColor = 'black',
  boardTheme = 'classic',
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
  const pieces = useMemo(
    () => makePieces(whitePieceColor, blackPieceColor),
    [whitePieceColor, blackPieceColor],
  )
  const theme = CHESSBOARD_THEMES.find(({ id }) => id === boardTheme)
  if (!theme) throw new RangeError(`Unsupported chessboard theme: ${boardTheme}`)

  const boardImage = boardAssets[`./assets/chess_boards/${theme.asset}`]
  if (!boardImage) throw new Error(`Missing chessboard asset: ${theme.asset}`)

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
      pieces,
      boardStyle: {
        backgroundImage: `url("${boardImage}")`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
      },
      darkSquareStyle: { backgroundColor: 'transparent' },
      lightSquareStyle: { backgroundColor: 'transparent' },
      darkSquareNotationStyle: { color: theme.dark },
      lightSquareNotationStyle: { color: theme.light },
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
    [
      fen,
      orientation,
      squareStyles,
      arrows,
      interactive,
      canDragPiece,
      onPieceDrop,
      onPieceDrag,
      onSquareClick,
      pieces,
      boardImage,
      theme,
    ],
  )

  return (
    <div className="overflow-hidden rounded-xl border border-slate-700/50 shadow-[0_0_40px_rgba(139,92,246,0.14)] ring-1 ring-black/40">
      <Chessboard options={options} />
    </div>
  )
})
