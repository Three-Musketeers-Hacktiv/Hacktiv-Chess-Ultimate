import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BACKGROUNDS,
  BOARD_THEME_PRESETS,
  DEFAULT_SELECTION,
  PIECE_SETS,
  THEME_PRESETS,
  matchingPreset,
  resolveTheme,
  sanitizeSelection,
} from '../lib/board-presets'
import { STORAGE_KEYS } from '../lib/config'
import { themeStore } from '../lib/storage'
import { ThemeContext } from './theme-context'

const readSelection = () => {
  const stored = themeStore.get()
  if (stored) return sanitizeSelection(stored)
  // First run after the upgrade: keep the board the player had already chosen.
  const legacyBoardId = themeStore.legacyBoardId()
  return sanitizeSelection(legacyBoardId ? { ...DEFAULT_SELECTION, boardId: legacyBoardId } : null)
}

const sameSelection = (a, b) =>
  a.boardId === b.boardId && a.piecesType === b.piecesType && a.backgroundId === b.backgroundId

/**
 * Owns the whole look of the app — board colours, piece set and wallpaper — as one persisted selection
 * (`hcu.globalTheme`, ids only). The value handed out is stable between changes, so consumers re-render only
 * when the look actually changes.
 */
export function ThemeProvider({ children }) {
  const [selection, setSelection] = useState(readSelection)

  /** Merge a partial selection; unknown ids are repaired by `sanitizeSelection`, no-ops keep the same state. */
  const update = useCallback((patch) => {
    setSelection((prev) => {
      const next = sanitizeSelection({ ...prev, ...patch })
      return sameSelection(prev, next) ? prev : next
    })
  }, [])

  /** Accept a board preset or its id. */
  const setBoardTheme = useCallback((next) => update({ boardId: typeof next === 'string' ? next : next?.id }), [update])
  const setPiecesType = useCallback((piecesType) => update({ piecesType }), [update])
  const setBackground = useCallback((backgroundId) => update({ backgroundId }), [update])
  const applyPreset = useCallback(
    (presetId) => {
      const preset = THEME_PRESETS.find((candidate) => candidate.id === presetId)
      if (preset) update({ boardId: preset.boardId, piecesType: preset.piecesType, backgroundId: preset.backgroundId })
    },
    [update],
  )

  useEffect(() => {
    themeStore.set(selection)
  }, [selection])

  // Keep every open tab on the same look.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_KEYS.globalTheme && event.key !== null) return
      const next = readSelection()
      setSelection((prev) => (sameSelection(prev, next) ? prev : next))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({
      /** The look in use: board colours + `piecesType` + `background` (a CSS background-image value). */
      boardTheme: resolveTheme(selection),
      activePresetId: matchingPreset(selection)?.id ?? null,
      themes: BOARD_THEME_PRESETS,
      pieceSets: PIECE_SETS,
      backgrounds: BACKGROUNDS,
      presets: THEME_PRESETS,
      setBoardTheme,
      setPiecesType,
      setBackground,
      applyPreset,
    }),
    [selection, setBoardTheme, setPiecesType, setBackground, applyPreset],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
