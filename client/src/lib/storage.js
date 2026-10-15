import { STORAGE_KEYS } from './config'

function read(storage, key) {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(storage, key, value) {
  try {
    if (value === null || value === undefined) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable (private mode / quota) — degrade silently */
  }
}

/** Persistent session (survives tab close). */
export const session = {
  getToken: () => read(localStorage, STORAGE_KEYS.token),
  getUser: () => read(localStorage, STORAGE_KEYS.user),
  save(token, user) {
    write(localStorage, STORAGE_KEYS.token, token)
    write(localStorage, STORAGE_KEYS.user, user)
  },
  clear() {
    write(localStorage, STORAGE_KEYS.token, null)
    write(localStorage, STORAGE_KEYS.user, null)
    write(sessionStorage, STORAGE_KEYS.lastGame, null)
    write(localStorage, STORAGE_KEYS.queue, null)
    write(localStorage, STORAGE_KEYS.capabilities, null)
  },
}

/** Last feature flags `GET /` reported — keeps menus unlocked across reloads until the server answers again. */
export const capabilityCache = {
  get: () => read(localStorage, STORAGE_KEYS.capabilities),
  set: (value) => write(localStorage, STORAGE_KEYS.capabilities, value),
}

/**
 * The visual theme: `{ boardId, piecesType, backgroundId }` under `hcu.globalTheme`. Device-level on purpose
 * (it survives sign-out). `legacyBoardId` is the board-only value stored before backgrounds/pieces existed.
 */
export const themeStore = {
  get: () => read(localStorage, STORAGE_KEYS.globalTheme),
  set: (selection) => write(localStorage, STORAGE_KEYS.globalTheme, selection),
  legacyBoardId: () => read(localStorage, STORAGE_KEYS.legacyBoardTheme),
}

// Migration: the pre-v2 key was filled while the server still ignored presets — drop it for good.
write(localStorage, STORAGE_KEYS.legacyUnsupportedTimes, null)

/** Time controls the server rejected or ignored when a queue entry was created (shown as "Coming Soon"). */
export const unsupportedTimes = {
  get: () => {
    const value = read(localStorage, STORAGE_KEYS.unsupportedTimes)
    return Array.isArray(value) ? value : []
  },
  add(id) {
    const next = [...new Set([...unsupportedTimes.get(), id])]
    write(localStorage, STORAGE_KEYS.unsupportedTimes, next)
    return next
  },
}

/**
 * The matchmaking queue entry we created (`{ id, time_control }`). The server has no "my queue" lookup,
 * so remembering it lets a page reload resume the search — or cancel it.
 */
export const queue = {
  get: () => read(localStorage, STORAGE_KEYS.queue),
  set: (value) => write(localStorage, STORAGE_KEYS.queue, value),
  clear: () => write(localStorage, STORAGE_KEYS.queue, null),
}

/** The last finished match, kept per tab so the analysis page survives a refresh. */
export const lastGame = {
  get: () => read(sessionStorage, STORAGE_KEYS.lastGame),
  set: (value) => write(sessionStorage, STORAGE_KEYS.lastGame, value),
}
