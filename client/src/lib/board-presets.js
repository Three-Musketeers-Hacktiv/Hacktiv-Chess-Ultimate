import { BACKGROUNDS, DEFAULT_BACKGROUND, findBackground } from './backgrounds'

/**
 * Board colour presets. `darkSquare` / `lightSquare` feed react-chessboard's `darkSquareStyle` /
 * `lightSquareStyle` (the v5 names of v4's `customDarkSquareStyle` / `customLightSquareStyle`).
 */
export const BOARD_THEME_PRESETS = Object.freeze([
  Object.freeze({ id: 'obsidian', name: 'Obsidian', darkSquare: '#2C3545', lightSquare: '#E2E8F0' }),
  Object.freeze({ id: 'classic-wood', name: 'Classic Wood', darkSquare: '#b8860b', lightSquare: '#f5deb3' }),
  Object.freeze({ id: 'emerald-club', name: 'Emerald Club', darkSquare: '#718b53', lightSquare: '#eeeed2' }),
  Object.freeze({ id: 'deep-tournament', name: 'Deep Tournament', darkSquare: '#4b7399', lightSquare: '#eae9d2' }),
  Object.freeze({ id: 'obsidian-neon', name: 'Obsidian Neon', darkSquare: '#1e293b', lightSquare: '#cbd5e1' }),
])

/**
 * Piece sets. The bundled artwork is one drawing in several fills, so a set is a pair of fills
 * (`white` = the first player's pieces, `black` = the second's); see `components/chess/pieceAssets.js`.
 */
export const PIECE_SETS = Object.freeze([
  Object.freeze({ id: 'classic', name: 'Classic', white: 'white', black: 'black' }),
  Object.freeze({ id: 'wood', name: 'Wood', white: 'white', black: 'black', aliasOf: 'classic' }),
  Object.freeze({ id: 'neo', name: 'Neo', white: 'blue', black: 'black' }),
  Object.freeze({ id: 'emerald', name: 'Emerald', white: 'green', black: 'black' }),
  Object.freeze({ id: 'ember', name: 'Ember', white: 'yellow', black: 'red' }),
])

/** A harmonious bundle of the three visual choices. */
export const THEME_PRESETS = Object.freeze([
  Object.freeze({
    id: 'obsidian-gothic',
    name: 'Obsidian Gothic',
    boardId: 'obsidian-neon',
    piecesType: 'neo',
    backgroundId: 'gothic-castle',
  }),
  Object.freeze({
    id: 'classic-tournament',
    name: 'Classic Tournament',
    boardId: 'deep-tournament',
    piecesType: 'wood',
    backgroundId: 'matte-slate',
  }),
  Object.freeze({
    id: 'emerald-luxury',
    name: 'Emerald Luxury',
    boardId: 'emerald-club',
    piecesType: 'emerald',
    backgroundId: 'forest-glow',
  }),
])

export const DEFAULT_THEME_PRESET = THEME_PRESETS[0]
export const DEFAULT_BOARD_THEME = BOARD_THEME_PRESETS.find((board) => board.id === DEFAULT_THEME_PRESET.boardId)
export const DEFAULT_PIECE_SET = PIECE_SETS.find((set) => set.id === DEFAULT_THEME_PRESET.piecesType)

/** The board preset with this id — the default when the id is unknown (e.g. a stale value in localStorage). */
export const findBoardTheme = (id) => BOARD_THEME_PRESETS.find((preset) => preset.id === id) ?? DEFAULT_BOARD_THEME
export const findPieceSet = (id) => PIECE_SETS.find((set) => set.id === id) ?? DEFAULT_PIECE_SET

/** What is persisted: ids only, so stored data can never smuggle in a style or a URL. */
export const DEFAULT_SELECTION = Object.freeze({
  boardId: DEFAULT_THEME_PRESET.boardId,
  piecesType: DEFAULT_THEME_PRESET.piecesType,
  backgroundId: DEFAULT_THEME_PRESET.backgroundId,
})

/** Anything → a valid selection: unknown or missing ids fall back to the default one, field by field. */
export function sanitizeSelection(raw) {
  return {
    boardId: findBoardTheme(raw?.boardId).id,
    piecesType: findPieceSet(raw?.piecesType).id,
    backgroundId: (findBackground(raw?.backgroundId) ?? DEFAULT_BACKGROUND).id,
  }
}

/** Selection → the object consumers read as `boardTheme` (see ThemeContext). */
export function resolveTheme({ boardId, piecesType, backgroundId }) {
  const board = findBoardTheme(boardId)
  const background = findBackground(backgroundId) ?? DEFAULT_BACKGROUND
  return {
    ...board, // id, name, darkSquare, lightSquare
    piecesType,
    backgroundId: background.id,
    background: background.css,
  }
}

/** The bundle whose three parts all match the selection, if any. */
export const matchingPreset = ({ boardId, piecesType, backgroundId }) =>
  THEME_PRESETS.find(
    (preset) => preset.boardId === boardId && preset.piecesType === piecesType && preset.backgroundId === backgroundId,
  ) ?? null

export { BACKGROUNDS }
