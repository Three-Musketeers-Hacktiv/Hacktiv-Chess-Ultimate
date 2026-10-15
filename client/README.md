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
| Matchmaking | Server-side queue. `POST /api/games { mode: 'pvp', time_control }` → `200 matched` (go to `/arena/:id`) or `202 searching` (wait for the private `game_started` event; `GET /api/games/:id` is polled every 3 s as a safety net). `DELETE /api/games/:id/matchmaking` cancels (`409 MATCH_ALREADY_FOUND` → open that game). The queue entry is remembered in `localStorage` so a reload resumes the search. |
| Joining a game | `emit('watch_game', { room_id })` → `game_state` snapshot (PGN, players, status, clocks). Re-sent on every reconnect. Only `in_progress` games can be watched; a queued room is refused (`WATCH_FORBIDDEN`). |
| Move sync | chess.js legal check → optimistic apply → `POST /api/games/:id/moves`; failure rolls the move back. Room broadcasts (`move`, `game_over`) are applied idempotently by ply count, with a PGN resync if a move was missed. |
| Clocks | Server snapshots (`white_ms`, `black_ms`, `active_color`); the active clock is interpolated inside `ClockDisplay` only. |
| Live board | Handlers are referentially stable and `ChessBoardPanel` is `memo`-ised, so only position/highlight changes re-render the board. |
| Post-game | `game_over` opens a modal; "Review analysis" opens `/analysis`, which on mount sends the game's PGN to `POST /api/game/analyze { pgn }` (≤ 60 half-moves; the id-based `POST /api/games/:id/analysis` is only a fallback when no PGN exists) and maps `{ ply, move, evaluation:{cp,mate}, centipawn_loss, label, best_alternative }` onto the replay. Best Move chips are emerald, Blunders vermillion, and a Mistake/Blunder row has a collapsible "Stockfish suggests" box. If the engine is offline (`ENGINE_UNAVAILABLE`) or the game is too long, a plain replay with a notice is shown. |
| Bot games | `POST /api/games { mode: 'bot', time_control, difficulty }` → `201`, straight to `/arena/:id`. Stockfish's replies arrive as `move` events. Unlocked only when `GET /` reports `bot: available`. No draw offers vs the bot (server: PvP only); "Tantang Lagi" starts a new bot game with the same settings. |

## Backend audit (what `server/` really implements)

| Server capability | Client |
| --- | --- |
| `POST /api/auth/register`, `/login` | `AuthContext`, Login/Register pages |
| `GET /` (stats + feature catalogue with `available`/`planned`) | `useHome` → record tiles, feature tiles, capability flags |
| `POST /api/games`, `DELETE /:id/matchmaking`, socket `game_started` (private `user:<id>` room) | `useMatchmaking` ("Cari Lawan" + "Cancel Search"). `GET /open` and `POST /:id/join` were **removed** from the server and from the client. |
| `GET /api/games/live` | Lobby "Games in progress" (only shown when non-empty) — spectate or rejoin your own running game |
| `POST /:id/moves`, `/resign` | `useLiveGame` |
| `POST /:id/draw-offers`, `/draw-offers/response`, `/draw-claims` | "Offer Draw" button + status line (`ArenaPage`), `DrawOfferModal` (accept / decline), `DrawClaimPanel` (claims gated by chess.js) |
| Socket `watch_game` → `game_state`; `move`, `game_over` (also from the 1 s timeout sweeper), `draw_offer`, `draw_response`, `game_error` | `useLiveGame` |
| `GET /api/games/:id` (players only) | `useMatchmaking` — resume after reload and `game_started` fallback poll |

**Flagged "Coming Soon"** (absent in `server/`, UI kept and guarded by `lib/capabilities.js`):

- PvP rematch and ranked matchmaking when `GET /` does not report `capabilities.rematch` / `capabilities.ranked` as `available` (older server): the rematch button shows "Coming Soon" and nothing is emitted; the ranked button is disabled.
- Stockfish analysis and bot games when `GET /` says `planned` (i.e. `STOCKFISH_PATH` is not configured on the server).
- Daily puzzle, tournaments (`planned`).
- Profile (`GET /api/profile/me`) and game history (`GET /api/games`) exist on the server but have no client screen yet; their lobby tiles stay "Coming Soon".

Also wired: `POST /api/auth/logout` (token revocation) on user sign-out.

The socket listens to `watch_game`, `request_rematch` and `decline_rematch` (no `offer_draw`, `leave_room`); draws are REST-only and already wired.

**Ranked + rematch (server + client)**

| Piece | Where |
| --- | --- |
| Elo (K = 32, ±200 queue window), `users.elo_rating` default 1500 | `server/src/utils/elo.js`, `game.service.js` (`finishGame` books both ratings in the game-ending transaction), migration `202610150001-…` |
| `POST /api/matchmaking/join { mode: 'ranked' \| 'casual', time_control }` | `matchmakingApi.join` → `useMatchmaking.start(timeControl, mode)`; the "Competitive Ranked Match" card in `LobbyPage`; the player's Elo is shown from `GET /` (`home.user.elo_rating`) and refreshed whenever the lobby opens |
| `game_over` / game objects carry `ranked` and `elo: { white\|black: { before, change, after } }` | `useLiveGame` → `outcome.elo`; `GameOverModal` + `EloChange` render `+16 ELO` (emerald) / `-14 ELO` (crimson) with a count-up and pulse; `PlayerCard` shows the live rating |
| Socket rematch: `request_rematch` → `rematch_requested` (ack) / `rematch_pending` (opponent) → `rematch_started` | `useRematch` (all listeners cleaned up on unmount; leaving the arena withdraws an open challenge), `RematchChallengeModal` ("Opponent challenges you to a Rematch! Accept?"). `rematch_started` carries the new `room_id`; `ArenaPage` is keyed by room, so board, clocks, orientation (colours swap) and move log restart from the new `game_state`. |

Server-side limits: there is no "my current queue" lookup. A queue entry created from another browser/device with a different time control answers `409 MATCHMAKING_ALREADY_QUEUED` and cannot be cancelled from here — the server message is shown instead.
