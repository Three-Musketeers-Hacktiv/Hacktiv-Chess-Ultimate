# Hacktiv Chess Ultimate — Client

Vite + React 19 SPA (React Router, Tailwind CSS v4, Socket.IO, `react-chessboard`, `chess.js`).
Talks to the real backend in [`../server`](../server) — contract: [`../server/API.md`](../server/API.md).

## Run

Start the server first (`../server`, default `http://localhost:3000`, Postgres required), then:

```bash
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:3000
npm run dev              # http://localhost:5173
```

The server's `CLIENT_URL` must include the Vite origin (CORS applies to REST and the Socket.IO handshake).

## Architecture

```
src/
  context/   AuthContext (JWT + user)  ·  SocketContext (one io() instance, JWT in handshake)
  hooks/     useAuth · useSocket · useMatchmaking · useLiveGames · useLiveGame · useGameAnalysis · useAbortable
  lib/       api (fetch wrapper) · config (URLs, event names, time controls) · storage · chess helpers · analysis mapping
  components/ ui (design system) · layout · auth · chess · analysis
  pages/     Login · Register · Lobby · Arena · Analysis · NotFound
```

| Concern | Decision |
| --- | --- |
| Auth | Token + user persisted in `localStorage`; any `401` or socket auth error signs the user out everywhere. |
| Socket | Created once above `<Routes />` with `auth: { token }`; torn down only when the token changes. |
| Matchmaking | REST: `POST /api/games` (create), `GET /api/games/open` (polled), `POST /api/games/:id/join`. Both create and join navigate to `/arena/:id`. |
| Joining a game | `emit('watch_game', { room_id })` → `game_state` snapshot (PGN, players, status, clocks). Re-sent on every reconnect, and polled every 2.5 s while the room is `waiting` (the server does not announce a joiner). |
| Move sync | chess.js legal check → optimistic apply → `POST /api/games/:id/moves`; failure rolls the move back. Room broadcasts (`move`, `game_over`) are applied idempotently by ply count, with a PGN resync if a move was missed. |
| Clocks | Server snapshots (`white_ms`, `black_ms`, `active_color`); the active clock is interpolated inside `ClockDisplay` only. |
| Live board | Handlers are referentially stable and `ChessBoardPanel` is `memo`-ised, so only position/highlight changes re-render the board. |
| Post-game | `game_over` opens a modal; the PGN movetext is POSTed to `/api/game/analyze` (not implemented by the server yet — the page shows a friendly message) and mapped to plies. |

## Backend audit (what `server/` really implements)

| Server capability | Client |
| --- | --- |
| `POST /api/auth/register`, `/login` | `AuthContext`, Login/Register pages |
| `GET /` (stats + feature catalogue with `available`/`planned`) | `useHome` → record tiles, feature tiles, capability flags |
| `POST /api/games`, `GET /open`, `POST /:id/join` | `useMatchmaking` ("Cari Lawan" — joins a rival's room or opens one; the room list itself is not shown) |
| `GET /api/games/live` | Lobby "Games in progress" (only shown when non-empty) — spectate or rejoin your own running game |
| `POST /:id/moves`, `/resign` | `useLiveGame` |
| `POST /:id/draw-offers`, `/draw-offers/response`, `/draw-claims` | "Offer Draw" button + status line (`ArenaPage`), `DrawOfferModal` (accept / decline), `DrawClaimPanel` (claims gated by chess.js) |
| Socket `watch_game` → `game_state`; `move`, `game_over` (also from the 1 s timeout sweeper), `draw_offer`, `draw_response`, `game_error` | `useLiveGame` |
| `GET /api/games/:id` | Not wired on purpose: `watch_game` already returns the same PGN/state, and there is no history list endpoint to supply game IDs |

**Flagged "Coming Soon"** (absent in `server/`, UI kept and guarded by `lib/capabilities.js`):

- Rematch (`request_rematch` has no listener) — button shows the badge and a toast, nothing is emitted.
- Stockfish analysis (`/api/game/analyze`, `planned` in `GET /`) — no request is made; the page offers a plain move-by-move replay.
- Bot games (`mode: "bot"` rejected; `planned`), game history, daily puzzle, tournaments.
- A real matchmaking queue (`join_room` / `game_started`): "Cari Lawan" pairs players client-side over open rooms.

Server-side limits: no `leave_room` / cancel endpoint. "Cancel Search" resets the UI and emits `leave_room` (best effort, ignored today), so an abandoned room stays open until someone joins it.
