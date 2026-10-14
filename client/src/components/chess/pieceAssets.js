const urls = import.meta.glob('./assets/chess_pieces/**/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const COLOR_CODES = Object.freeze({
  white: 'l',
  black: 'd',
  blue: 'b',
  green: 'g',
  red: 'r',
  yellow: 'y',
})

const PIECE_CODES = Object.freeze({ K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n', P: 'p' })

export const PIECE_TYPES = Object.freeze(Object.keys(PIECE_CODES))

/** URL of one piece artwork, e.g. `pieceUrl('blue', 'N')`. Throws for an unknown colour or a missing file. */
export function pieceUrl(color, piece) {
  const colorLetter = COLOR_CODES[color]
  if (!colorLetter) throw new RangeError(`Unsupported chess piece color: ${color}`)
  const path = `./assets/chess_pieces/${color}/Chess_${PIECE_CODES[piece]}${colorLetter}t45.svg`
  const src = urls[path]
  if (!src) throw new Error(`Missing chess piece asset: ${path}`)
  return src
}
