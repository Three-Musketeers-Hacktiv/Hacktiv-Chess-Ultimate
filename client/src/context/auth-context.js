import { createContext } from 'react'

/** Shape: `{ token, user, isAuthenticated, login, register, logout, updateUser, expireSession }` — see AuthContext.jsx. */
export const AuthContext = createContext(null)
