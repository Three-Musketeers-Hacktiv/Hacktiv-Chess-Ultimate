# Hacktiv Chess Ultimate — Client

Vite + React 19 SPA (React Router, Tailwind CSS v4, Socket.IO, `react-chessboard`, `chess.js`).
Built strictly against the contract in [`../API Documentation.md`](../API%20Documentation.md).

## Run

```bash
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:3000
npm run dev              # http://localhost:5173
```

### No backend yet? Use the mock

```bash
npm run mock             # contract-compatible REST + Socket.IO stand-in on :3000
```

- Register → login works with any credentials.
- `join_room` pairs you with a simulated `player2` after ~1.5 s; `start_bot_match` starts GM Magnus Carlsen (random legal replies).
- `/api/game/analyze` returns deterministic fake labels so the review dashboard can be exercised.
- `GET http://localhost:3000/__debug/game_over?winner=player1` ends the running game (use it to open the post-game flow quickly).

## Architecture

```
src/
  context/   AuthContext (JWT + user, login/register/logout)  ·  SocketContext (one io() instance, JWT in handshake)
  hooks/     useAuth · useSocket · useMatchmaking · useChessGame · useGameAnalysis · useAbortable
  lib/       api (fetch wrapper) · config (URLs + event names) · storage · chess helpers · analysis mapping
  components/ ui (design system) · layout · auth · chess · analysis
  pages/     Login · Register · Lobby · Arena · Analysis · NotFound
```

| Concern | Decision |
| --- | --- |
| Routing | `BrowserRouter` + `ProtectedRoute` / `PublicOnlyRoute`; Arena and Analysis are `React.lazy` chunks. |
| Auth | Token + user persisted in `localStorage`; any `401` or socket auth error signs the user out everywhere. |
| Socket | Created once above `<Routes />`, torn down only when the token changes. `resetConnection()` is how matchmaking is cancelled (the contract has no "leave queue" event). |
| Live board | `chess.js` instance lives in `useChessGame`; handlers are referentially stable and `ChessBoardPanel` is `memo`-ised, so only position/highlight changes re-render the board. |
| Move sync | Local legal-move check → optimistic apply → `emit('move', {from,to,promotion?})`. Incoming `move` events are replayed onto the same instance (an echo of our own move is rejected by chess.js, so it is idempotent). |
| Post-game | `game_over` opens a modal; the PGN movetext (`1. e4 e5 …`) is POSTed to `/api/game/analyze` and each item is mapped to a ply (`move_number` + SAN) so the board can show the played move and the suggested alternative. |

## Realtime contract used

| Direction | Event | Payload |
| --- | --- | --- |
| client → server | `join_room` | – |
| client → server | `start_bot_match` | `{ difficulty: "magnus" }` |
| server → client | `game_started` | `{ room_id, color: "w"\|"b", opponent: { username, rating } }` |
| both | `move` | `{ from, to, promotion? }` |
| server → client | `game_over` | `{ status, winner, message }` |
