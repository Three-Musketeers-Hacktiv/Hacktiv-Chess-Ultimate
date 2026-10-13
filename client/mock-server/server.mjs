/**
 * Development-only stand-in for the Express/Socket.IO backend, implementing the
 * contract in "API Documentation.md" so the client can be exercised end-to-end
 * before the real server ships. Run with:  npm run mock
 *
 *  - Any email/password pair registered via /api/auth/register can sign in.
 *  - `join_room` pairs you with a simulated human after ~1.5s.
 *  - `start_bot_match` starts a game vs "GM Magnus Carlsen" (random legal replies).
 *  - /api/game/analyze labels moves deterministically from the PGN.
 */
import { createServer } from 'node:http'
import { Chess } from 'chess.js'
import { Server } from 'socket.io'

const PORT = Number(process.env.PORT ?? 3000)
const users = new Map() // email -> { id, username, password }

const json = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  })
  res.end(JSON.stringify(body))
}

const readBody = (req) =>
  new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'))
      } catch {
        resolve({})
      }
    })
  })

function analyze(pgn) {
  const chess = new Chess()
  chess.loadPgn(pgn)
  return chess.history({ verbose: true }).map((move, i) => {
    const hash = (move.san.charCodeAt(0) + i * 7) % 5
    const label = hash === 0 ? 'Blunder' : hash === 1 ? 'Mistake' : 'Best Move'
    const before = new Chess(move.before)
    const alternatives = before.moves().filter((m) => m !== move.san)
    const evalValue = ((hash - 2) * 0.7 + (i % 3) * 0.1).toFixed(1)
    return {
      move_number: Math.ceil((i + 1) / 2),
      move: move.san,
      evaluation: Number(evalValue) > 0 ? `+${evalValue}` : evalValue,
      label,
      best_alternative: label === 'Best Move' ? null : (alternatives[(i * 3) % alternatives.length] ?? null),
    }
  })
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  const body = req.method === 'POST' ? await readBody(req) : {}

  if (req.url === '/api/auth/register' && req.method === 'POST') {
    const email = String(body.email ?? '').toLowerCase()
    if (users.has(email)) return json(res, 409, { message: 'Email already registered' })
    users.set(email, { id: users.size + 1, username: body.username, password: body.password })
    return json(res, 201, { status: 'success', message: 'Akun berhasil dibuat. Silakan login.' })
  }

  if (req.url === '/api/auth/login' && req.method === 'POST') {
    const user = users.get(String(body.email ?? '').toLowerCase())
    if (!user || user.password !== body.password) return json(res, 401, { message: 'Invalid email or password' })
    // Stateless token so a mock restart does not sign everyone out.
    const token = `mock.${Buffer.from(JSON.stringify({ id: user.id, username: user.username })).toString('base64url')}`
    return json(res, 200, { status: 'success', token, user: { id: user.id, username: user.username } })
  }

  // Debug helper: end whichever game(s) are running — `GET /__debug/game_over?winner=Name`
  if (req.url?.startsWith('/__debug/game_over')) {
    const winner = new URL(req.url, 'http://x').searchParams.get('winner')
    let ended = 0
    for (const socket of io.sockets.sockets.values()) {
      if (!socket.data.game) continue
      const message = winner ? `${winner} wins by checkmate!` : 'Game drawn by agreement.'
      socket.emit('game_over', { status: winner ? 'checkmate' : 'draw', winner, message })
      socket.data.game = null
      ended += 1
    }
    return json(res, 200, { ok: true, sockets: io.sockets.sockets.size, ended })
  }

  if (req.url === '/api/game/analyze' && req.method === 'POST') {
    try {
      await new Promise((r) => setTimeout(r, 1200))
      return json(res, 200, { status: 'success', analysis: analyze(body.pgn ?? '') })
    } catch {
      return json(res, 400, { message: 'Invalid PGN' })
    }
  }

  return json(res, 404, { message: 'Not found' })
})

const io = new Server(server, { cors: { origin: '*' } })

io.use((socket, next) => {
  try {
    const raw = String(socket.handshake.auth?.token ?? '')
    if (!raw.startsWith('mock.')) throw new Error('bad token')
    socket.data.user = JSON.parse(Buffer.from(raw.slice(5), 'base64url').toString())
    next()
  } catch {
    next(new Error('Authentication error: invalid token'))
  }
})

function startGame(socket, opponent, color) {
  const chess = new Chess()
  const roomId = `room_${Math.random().toString(36).slice(2, 8)}`
  socket.data.game = { chess, color, roomId, opponent }
  socket.emit('game_started', { room_id: roomId, color, opponent })
  if (color === 'b') setTimeout(() => replyMove(socket), 800)
}

function checkEnd(socket) {
  const { chess, opponent, color } = socket.data.game
  if (!chess.isGameOver()) return false
  const loser = chess.turn()
  const status = chess.isCheckmate() ? 'checkmate' : chess.isStalemate() ? 'stalemate' : 'draw'
  const winner = status === 'checkmate' ? (loser === color ? opponent.username : socket.data.user.username) : null
  const message = winner ? `${winner} wins by ${status}!` : `Game drawn (${status}).`
  socket.emit('game_over', { status, winner, message })
  socket.data.game = null
  return true
}

function replyMove(socket) {
  const game = socket.data.game
  if (!game || game.chess.isGameOver()) return
  const moves = game.chess.moves({ verbose: true })
  const pick = moves[Math.floor(Math.random() * moves.length)]
  game.chess.move(pick)
  socket.emit('move', { from: pick.from, to: pick.to, ...(pick.promotion ? { promotion: pick.promotion } : {}) })
  checkEnd(socket)
}

io.on('connection', (socket) => {
  socket.on('join_room', () => {
    setTimeout(() => {
      if (socket.connected && !socket.data.game) startGame(socket, { username: 'player2', rating: 1500 }, 'w')
    }, 1500)
  })

  socket.on('start_bot_match', () => {
    startGame(socket, { username: 'GM Magnus Carlsen', rating: 2882 }, 'w')
  })

  socket.on('move', (payload) => {
    const game = socket.data.game
    if (!game) return
    try {
      game.chess.move({ from: payload.from, to: payload.to, promotion: payload.promotion })
    } catch {
      return
    }
    if (!checkEnd(socket)) setTimeout(() => replyMove(socket), 700)
  })

  socket.on('disconnect', () => {
    socket.data.game = null
  })
})

server.listen(PORT, () => console.log(`[mock] Hacktiv Chess mock server on http://localhost:${PORT}`))
