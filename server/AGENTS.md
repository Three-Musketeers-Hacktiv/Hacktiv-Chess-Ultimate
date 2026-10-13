# AGENTS.md

## Backend scope

Build the Hacktiv Chess MVP in this `server` directory.

## Stack and architecture

- Use Node.js with Express for the REST API.
- Use PostgreSQL with Sequelize for persistent users and games.
- Use Socket.IO for real-time PvP move notifications and game events. The server owns and validates canonical game state.
- Use the Stockfish executable for bot moves and post-game PGN analysis. Read its path from `STOCKFISH_PATH`; do not hard-code machine-specific paths.
- Organize code by responsibility under `src/config`, `src/models`, `src/middleware`, `src/routes`, `src/services`, and `src/socket`.

## MVP boundaries

- Prioritize authentication, PvP and bot games, server-side legal move validation, saved PGN/game history, basic win-draw-loss statistics, and Stockfish analysis.
- Require registration and login before a player can create or join PvP games. Use the authenticated user ID as the owner of games, history, and statistics.
- After successful login, the client loads authenticated `GET /` and shows the home screen with game modes and feature options. The player chooses PvP or Bot from there; keep login independent of game mode and send the selected mode to `POST /api/games`.
- In the PvP lobby, provide a **Room Terbuka** tab backed by `GET /api/games/open`. A player can create a waiting room or join one with `POST /api/games/:id/join`; only one join may claim a room, and competing joins must receive a conflict response.
- After joining, both authenticated players subscribe to the same game using Socket.IO `watch_game` and the returned room ID. Authenticated non-players may list active PvP games with `GET /api/games/live` and subscribe to an in-progress PvP game as read-only spectators; spectator access never grants permission to submit moves. Validate access, join the Socket.IO game room, then send the latest `game_state` snapshot. Serialize subscription snapshots and move broadcasts per game so clients cannot end on a stale position. Broadcast each validated and persisted move from either player, with updated FEN and PGN, and `game_over` to all subscribers in real time.
- Store passwords only as bcrypt hashes. Require a valid JWT for protected REST routes and Socket.IO connections; never return password hashes.
- Keep API contracts documented in `API.md` and preserve the public events/endpoints in the project API documentation.
- Do not add speculative features or dependencies. Daily puzzles need an agreed, valid puzzle collection before implementation.

## API engineering

- Postman CLI is installed and may be used for API engineering.
- Keep secrets in environment variables; never commit `.env` or credentials.
- Return consistent JSON errors and validate request data at API boundaries.
