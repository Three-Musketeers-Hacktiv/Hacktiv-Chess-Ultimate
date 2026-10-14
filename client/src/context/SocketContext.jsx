import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'
import { API_URL } from '../lib/config'
import { session } from '../lib/storage'
import { SocketContext } from './socket-context'

const AUTH_ERROR = /auth|token|jwt|unauthori[sz]ed|forbidden/i

/**
 * Exactly one Socket.IO connection per signed-in session.
 * The instance survives route changes (it lives above <Routes />) and is torn
 * down only when the JWT disappears or changes.
 */
export function SocketProvider({ children }) {
  const { token, logout } = useAuth()
  const [connection, setConnection] = useState(null)
  const [transportStatus, setTransportStatus] = useState('connecting') // connecting | connected | disconnected | error

  useEffect(() => {
    if (!token) return undefined

    const client = io(API_URL, {
      // Callback form → the freshest JWT is sent on every (re)connection handshake.
      auth: (cb) => cb({ token: session.getToken() ?? token }),
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
    })

    setConnection(client)

    client.on('connect', () => setTransportStatus('connected'))
    client.on('disconnect', () => setTransportStatus('disconnected'))
    client.on('connect_error', (error) => {
      setTransportStatus('error')
      if (AUTH_ERROR.test(error?.message ?? '')) logout()
    })
    client.io.on('reconnect_attempt', () => setTransportStatus('connecting'))

    return () => {
      client.removeAllListeners()
      client.io.removeAllListeners()
      client.disconnect()
      setTransportStatus('connecting') // ready for the next session's handshake
    }
  }, [token, logout])

  // Signed out → expose nothing, even though the last (now closed) instance may still sit in state.
  const socket = token ? connection : null
  const status = token ? transportStatus : 'idle'

  const value = useMemo(() => ({ socket, status }), [socket, status])

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
