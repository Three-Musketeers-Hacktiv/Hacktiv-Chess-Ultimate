import { Chess } from 'chess.js'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

/** `'w'` → `'white'` for react-chessboard's `boardOrientation`. */
export const orientationOf = (color) => (color === 'b' ? 'black' : 'white')

/** Locates the king square of the side to move when it is in check (for the alert highlight). */
export function findCheckedKing(chess) {
  if (!chess.inCheck()) return null
  const turn = chess.turn()
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece && piece.type === 'k' && piece.color === turn) return piece.square
    }
  }
  return null
}

/**
 * Plain PGN movetext (`1. e4 e5 2. Nf3 Nc6`) as required by `/api/game/analyze`.
 * chess.js' own `pgn()` prepends the seven-tag roster, which the contract does not want.
 */
export function toMovetext(sanMoves) {
  const parts = []
  sanMoves.forEach((san, index) => {
    if (index % 2 === 0) parts.push(`${index / 2 + 1}.`)
    parts.push(san)
  })
  return parts.join(' ')
}

/** Does moving `from → to` require choosing a promotion piece? */
export function isPromotionMove(chess, from, to) {
  return chess.moves({ square: from, verbose: true }).some((m) => m.to === to && m.promotion)
}

/**
 * Replays a PGN into an ordered ply list with the FEN before/after each half-move.
 * Returns `[]` for unreadable PGN so callers can degrade gracefully.
 */
export function replayPgn(pgn) {
  if (!pgn) return []
  try {
    const chess = new Chess()
    chess.loadPgn(pgn)
    return chess.history({ verbose: true }).map((m, index) => ({
      ply: index + 1,
      color: m.color,
      san: m.san,
      from: m.from,
      to: m.to,
      fenBefore: m.before,
      fenAfter: m.after,
    }))
  } catch {
    return []
  }
}

/** Result from the local player's point of view: 'win' | 'loss' | 'draw'. */
export function resolveVerdict(outcome, me) {
  const status = String(outcome?.status ?? '').toLowerCase()
  if (!outcome?.winner || status === 'draw' || status === 'stalemate') return 'draw'
  return outcome.winner === me ? 'win' : 'loss'
}

/** Resolves a SAN suggestion (e.g. `Nf6`) to board squares in the given position. */
export function resolveSan(fen, san) {
  if (!fen || !san) return null
  try {
    const move = new Chess(fen).move(san)
    return { san: move.san, from: move.from, to: move.to }
  } catch {
    return null
  }
}
