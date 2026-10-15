import { createContext } from 'react'

/**
 * Shape: `{ boardTheme, activePresetId, themes, pieceSets, backgrounds, presets,
 * setBoardTheme, setPiecesType, setBackground, applyPreset }` — see ThemeContext.jsx.
 */
export const ThemeContext = createContext(null)
