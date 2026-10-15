import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'
import { API_URL } from '../lib/config'
import { isTokenExpired } from '../lib/jwt'
import { session } from '../lib/storage'
import { SocketContext } from './socket-context'

/**
 * The only two handshake rejections that mean "your JWT is no good" (server/src/socket/auth.js).
 * Anything else — a database outage, a CORS hiccup, the server being down — must NOT sign the user out
 * (a loose /token/ match once fired on a "relation revoked_tokens does not exist" DB error); the socket
 * just keeps retrying with back-off.
 */
const AUTH_ERRORS = new Set(['authentication required', 'invalid or expired token'])
const isAuthError = (error) => AUTH_ERRORS.has(String(error?.message ?? '').trim().toLowerCase())

/**
 * Exactly one Socket.IO connection per signed-in session.
 * The instance survives route changes (it lives above <Routes />) and is torn
 * down — and its state cleared — as soon as the JWT disappears, expires or changes.
 */
export function SocketProvider({ children }) {
  const { token, expireSession } = useAuth()
  const [connection, setConnection] = useState(null)
  const [transportStatus, setTransportStatus] = useState('connecting') // connecting | connected | disconnected | error

  useEffect(() => {
    // No usable token in storage → no socket at all (and so no 401 handshake).
    const stored = session.getToken()
    if (!token || !stored || isTokenExpired(stored)) return undefined

    const client = io(API_URL, {
      // Callback form → the freshest JWT is sent on every (re)connection handshake.
      auth: (cb) => cb({ token: session.getToken() }),
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    })

    setConnection(client)

    client.on('connect', () => setTransportStatus('connected'))
    client.on('disconnect', (reason) => {
      setTransportStatus('disconnected')
      // The server dropped us on purpose (e.g. the token was revoked) and Socket.IO will not retry by itself.
      // Reconnect once: a still-valid token gets back in, a dead one is rejected below and signs us out.
      if (reason === 'io server disconnect') client.connect()
    })
    client.on('connect_error', (error) => {
      setTransportStatus('error')
      if (isAuthError(error)) {
        client.disconnect() // stop retrying with a dead token
        expireSession() // clears the session → this effect's cleanup runs and the state below is reset
      }
    })
    client.io.on('reconnect_attempt', () => setTransportStatus('connecting'))

    return () => {
      client.removeAllListeners()
      client.io.removeAllListeners()
      client.disconnect()
      setConnection(null)
      setTransportStatus('connecting') // ready for the next session's handshake
    }
  }, [token, expireSession])

  // Signed out → expose nothing, even for the render before the cleanup above has run.
  const socket = token ? connection : null
  const status = token ? transportStatus : 'idle'

  const value = useMemo(() => ({ socket, status }), [socket, status])

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
