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
  },
}

/** Time controls the server ignored when a room was created (shown as "Coming Soon"). */
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

/** The last finished match, kept per tab so the analysis page survives a refresh. */
export const lastGame = {
  get: () => read(sessionStorage, STORAGE_KEYS.lastGame),
  set: (value) => write(sessionStorage, STORAGE_KEYS.lastGame, value),
}
