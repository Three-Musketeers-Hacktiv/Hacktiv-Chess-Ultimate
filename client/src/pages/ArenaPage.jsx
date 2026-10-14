import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChessBoardPanel } from '../components/chess/ChessBoardPanel'
import { DrawClaimPanel } from '../components/chess/DrawClaimPanel'
import { DrawOfferModal } from '../components/chess/DrawOfferModal'
import { GameOverModal } from '../components/chess/GameOverModal'
import { MoveList } from '../components/chess/MoveList'
import { PlayerCard } from '../components/chess/PlayerCard'
import { PromotionPicker } from '../components/chess/PromotionPicker'
import { RematchChallengeModal } from '../components/chess/RematchChallengeModal'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, Eyebrow } from '../components/ui/Card'
import { FlagIcon, SearchIcon } from '../components/ui/Icons'
import { Modal } from '../components/ui/Modal'
import { FullPageLoader } from '../components/ui/Spinner'
import { Toast } from '../components/ui/Toast'
import { useAuth } from '../hooks/useAuth'
import { useBotGame } from '../hooks/useBotGame'
import { useHome } from '../hooks/useHome'
import { useLiveGame } from '../hooks/useLiveGame'
import { useRematch } from '../hooks/useRematch'
import { useSocket } from '../hooks/useSocket'
import { cn } from '../lib/cn'
import { orientationOf } from '../lib/chess'
import { timeControlLabel } from '../lib/config'
import { currentRating } from '../lib/elo'

const CONTROL =
  'flex w-full min-w-0 flex-1 items-center justify-center rounded-xl py-3 text-center text-[10px] font-semibold uppercase tracking-widest transition-all duration-300 active:scale-[0.99] sm:text-[11px]'

const CONTROL_REVIEW = `${CONTROL} border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/20`

const CONTROL_REMATCH = `${CONTROL} border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/20 disabled:pointer-events-none disabled:opacity-50`

const CONTROL_FIND =
  'group flex w-full items-center justify-center gap-2 rounded-xl border border-slate-900/60 bg-slate-950/40 py-3 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-300 shadow-md transition-all duration-300 hover:border-slate-700/80 hover:bg-slate-900/80 hover:text-white active:scale-[0.99]'

export default function ArenaPage() {
  const { roomId } = useParams()
  return <ArenaSession key={roomId} roomId={roomId} />
}

function StatusPill({ outcome, status, isMyTurn, isCheck, spectating }) {
  let tone = 'border-slate-700/60 bg-slate-800/50 text-slate-300'
  let label = "Opponent's move"

  if (outcome) {
    label = 'Game over'
    tone = 'border-slate-600/60 bg-slate-800/60 text-slate-200'
  } else if (status === 'waiting') {
    label = 'Waiting for opponent'
    tone = 'border-violet-500/40 bg-violet-500/10 text-violet-200 shadow-glow'
  } else if (spectating) {
    label = 'Spectating'
  } else if (isMyTurn) {
    label = isCheck ? 'Check — your move' : 'Your move'
    tone = isCheck
      ? 'border-red-500/40 bg-red-500/10 text-red-300 shadow-glow-crimson'
      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-glow-emerald'
  } else if (isCheck) {
    label = 'Opponent in check'
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-xs uppercase tracking-widest',
        'transition-all duration-300 ease-out',
        tone,
      )}
      role="status"
    >
      <span
        className={cn('size-1.5 rounded-full bg-current', (isMyTurn || status === 'waiting') && !outcome && 'animate-sheen')}
      />
      {label}
    </span>
  )
}

/** Small status line under the board; fades between states. */
function DrawStatus({ pending, unavailable }) {
  const text = unavailable
    ? 'Fitur Rematch & Remis (Coming Soon) - Sedang dikembangkan oleh Tim Backend'
    : pending
      ? 'Tawaran remis telah dikirim, menunggu jawaban lawan...'
      : ''

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        'min-h-5 text-center font-mono text-xs transition-opacity duration-300 ease-out',
        text ? 'opacity-100' : 'opacity-0',
        unavailable ? 'text-slate-500' : 'text-violet-300',
      )}
    >
      {text}
    </p>
  )
}

function Unavailable({ message }) {
  return (
    <Card className="mx-auto mt-10 max-w-md space-y-4 p-8 text-center">
      <Eyebrow>Game unavailable</Eyebrow>
      <p className="text-slate-300">{message}</p>
      <Link to="/lobby">
        <Button variant="secondary">Back to lobby</Button>
      </Link>
    </Card>
  )
}

function ArenaSession({ roomId }) {
  const { user } = useAuth()
  const { socket, status } = useSocket()
  const navigate = useNavigate()
  const me = user?.username ?? 'You'

  const game = useLiveGame({ socket, connected: status === 'connected', roomId, me, meId: user?.id })
  const { outcome, getPgn, info, myColor } = game

  const [dismissedOver, setDismissedOver] = useState(false)
  const [confirmResign, setConfirmResign] = useState(false)
  const [resigning, setResigning] = useState(false)
  const [offering, setOffering] = useState(false)

  // The server only accepts an offer on your own turn, once both sides have moved.
  let drawHint
  if (game.moves.length < 2) drawHint = 'Available once both players have moved'
  else if (!game.isMyTurn) drawHint = 'You can offer a draw on your own turn'

  const { offerDraw } = game
  const sendDrawOffer = useCallback(async () => {
    setOffering(true)
    await offerDraw()
    setOffering(false)
  }, [offerDraw])

  // Rematch: PvP uses the socket handshake (`request_rematch` → `rematch_pending` → `rematch_started`, which
  // navigates to the new room: this session is keyed by room id, so board, clocks, orientation and move log
  // restart clean). A game against Stockfish is just a new `POST /api/games { mode: 'bot' }`.
  const { capabilities } = useHome()
  const isBot = info.mode === 'bot'
  const pvpRematch = useRematch({ socket, roomId, supported: capabilities.rematch })
  const botGame = useBotGame()
  const { start: startBotGame } = botGame
  const botRematch = useCallback(
    () => startBotGame({ timeControl: info.timeControl ?? 'blitz', difficulty: info.botDifficulty ?? 'medium' }),
    [startBotGame, info.timeControl, info.botDifficulty],
  )
  const rematchStatus = isBot ? (botGame.starting ? 'starting' : 'idle') : pvpRematch.status
  const rematchBusy = ['starting', 'requesting', 'waiting', 'started'].includes(rematchStatus)
  const startRematch = isBot ? botRematch : pvpRematch.request

  // Leaving unmounts this session, which drops the chess.js instance and every piece of live-game state.
  const goLobby = useCallback(() => navigate('/lobby'), [navigate])
  const openAnalysis = useCallback(
    () => navigate('/analysis', { state: { pgn: getPgn(), gameId: roomId } }),
    [navigate, getPgn, roomId],
  )
  const closeOver = useCallback(() => setDismissedOver(true), [])

  const { resign } = game
  const confirmResignation = useCallback(async () => {
    setResigning(true)
    await resign()
    setResigning(false)
    setConfirmResign(false)
  }, [resign])

  if (game.fatal) return <Unavailable message={game.fatal} />
  if (!info.loaded) {
    return <FullPageLoader label={status === 'connected' ? 'Joining the game…' : 'Establishing realtime link…'} />
  }

  const spectating = myColor === null
  const bottomColor = myColor ?? 'w'
  const topColor = bottomColor === 'w' ? 'b' : 'w'
  const nameOf = (color) => (color === 'w' ? info.white : info.black)
  const live = info.status === 'in_progress' && !outcome
  const hasOffer = live && !spectating && Boolean(game.drawOffer)
  const incomingOffer = hasOffer && game.drawOffer.toLowerCase() !== me.toLowerCase()
  const outgoingOffer = hasOffer && !incomingOffer

  return (
    // No transform animation on the board's ancestors (opacity-only fade): see the note in `index.css`.
    <div className="grid animate-fade gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      {/* ───────── Board column ───────── */}
      <section className="mx-auto w-full max-w-[min(100%,calc(100dvh-15rem))] space-y-3" aria-label="Chess board">
        <PlayerCard
          name={nameOf(topColor)}
          rating={currentRating(info.elo, topColor)}
          color={topColor}
          clocks={game.clocks}
          active={live && game.turn === topColor}
          isYou={!spectating && topColor === myColor}
        />

        <ChessBoardPanel
          fen={game.fen}
          orientation={orientationOf(bottomColor)}
          lastMove={game.lastMove}
          checkSquare={game.checkSquare}
          selected={game.selected}
          legalTargets={game.legalTargets}
          interactive={game.isMyTurn}
          onPieceDrop={game.onPieceDrop}
          onPieceDrag={game.onPieceDrag}
          onSquareClick={game.onSquareClick}
          canDragPiece={game.canDragPiece}
        />

        <PlayerCard
          name={nameOf(bottomColor)}
          rating={currentRating(info.elo, bottomColor)}
          color={bottomColor}
          clocks={game.clocks}
          active={live && game.turn === bottomColor}
          isYou={!spectating && bottomColor === myColor}
        />

        <DrawStatus pending={Boolean(outgoingOffer)} unavailable={game.drawUnavailable && live} />
      </section>

      {/* ───────── Side panel ───────── */}
      <aside className="flex min-h-0 flex-col gap-4 lg:max-h-[calc(100dvh-8rem)]">
        {game.notice && (
          <Alert tone="error" className="flex items-start justify-between gap-3">
            <span>{game.notice}</span>
            <button type="button" onClick={game.dismissNotice} className="text-red-200/70 hover:text-red-100" aria-label="Dismiss">
              ✕
            </button>
          </Alert>
        )}

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>Live match</Eyebrow>
            {info.ranked && (
              <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-emerald-300 shadow-glow-emerald">
                Ranked
              </span>
            )}
          </div>
          <StatusPill
            outcome={outcome}
            status={info.status}
            isMyTurn={game.isMyTurn}
            isCheck={game.isCheck}
            spectating={spectating}
          />
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2">
              <p className="uppercase tracking-widest text-slate-600">Time</p>
              <p className="mt-1 truncate text-sm text-slate-200">{timeControlLabel(info.timeControl)}</p>
            </div>
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2">
              <p className="uppercase tracking-widest text-slate-600">Move</p>
              <p className="mt-1 text-sm tabular-nums text-slate-200">{Math.floor(game.moves.length / 2) + 1}</p>
            </div>
          </div>
        </Card>

        {live && !spectating && (
          <DrawClaimPanel claimable={game.claimable} isMyTurn={game.isMyTurn} onClaim={game.claimDraw} />
        )}

        <Card className="flex min-h-64 flex-1 flex-col overflow-hidden">
          <div className="border-b border-slate-800/60 px-5 py-3">
            <Eyebrow>Move timeline</Eyebrow>
          </div>
          <div className="min-h-0 flex-1">
            <MoveList moves={game.moves} />
          </div>
        </Card>

        {outcome ? (
          <div className="mt-4 w-full">
            {!spectating && (
              <div className="mb-3 flex w-full flex-row items-center gap-3 px-2">
                <button type="button" onClick={openAnalysis} className={CONTROL_REVIEW}>
                  Review Analisis
                </button>
                <button
                  type="button"
                  disabled={rematchBusy}
                  aria-busy={rematchBusy}
                  onClick={startRematch}
                  className={CONTROL_REMATCH}
                >
                  {rematchStatus === 'requesting' || rematchStatus === 'waiting'
                    ? 'Waiting'
                    : rematchBusy
                      ? 'Starting'
                      : 'Rematch'}
                </button>
              </div>
            )}
            <div className="w-full px-2">
              <button type="button" onClick={goLobby} className={CONTROL_FIND}>
                <SearchIcon className="size-3.5 text-slate-400 transition-colors duration-300 group-hover:text-white" />
                Cari Player Baru
              </button>
            </div>
          </div>
        ) : (
        <div className="flex gap-3">
          {live && !spectating ? (
            <>
              {/* The server only takes draw offers in PvP; against Stockfish you can still claim by rule. */}
              {!isBot && (
                <Button
                  variant="secondary"
                  className="flex-1"
                  loading={offering}
                  disabled={offering || Boolean(game.drawOffer) || game.moves.length < 2 || !game.isMyTurn}
                  title={drawHint}
                  onClick={sendDrawOffer}
                >
                  <span aria-hidden="true" className="font-mono text-base leading-none">
                    ½
                  </span>
                  Offer Draw
                </Button>
              )}
              <Button variant="danger" className="flex-1" onClick={() => setConfirmResign(true)}>
                <FlagIcon className="size-4" />
                Resign
              </Button>
            </>
          ) : (
            <Button variant="secondary" className="flex-1" onClick={goLobby}>
              Back to lobby
            </Button>
          )}
        </div>
        )}
      </aside>

      {/* ───────── Overlays ───────── */}
      <DrawOfferModal open={Boolean(incomingOffer)} from={game.drawOffer} onRespond={game.respondDraw} />

      <PromotionPicker
        open={Boolean(game.pendingPromotion)}
        color={bottomColor}
        onSelect={game.choosePromotion}
        onCancel={game.cancelPromotion}
      />

      <GameOverModal
        open={Boolean(outcome) && !dismissedOver}
        outcome={outcome}
        me={me}
        myColor={myColor}
        spectating={spectating}
        rematchStatus={rematchStatus}
        rematchError={pvpRematch.error}
        onRematch={startRematch}
        timeControl={typeof info.timeControl === 'string' ? info.timeControl : info.timeControl?.id}
        ranked={Boolean(info.ranked) && !isBot}
        gameMode={info.mode}
        opponentName={myColor === 'w' ? info.black : info.white}
        onAnalyze={openAnalysis}
        onDismiss={closeOver}
      />

      <RematchChallengeModal
        open={Boolean(pvpRematch.challenge) && !isBot && !spectating}
        from={pvpRematch.challenge?.by}
        ranked={info.ranked}
        busy={pvpRematch.status === 'requesting'}
        onAccept={pvpRematch.request}
        onDecline={pvpRematch.decline}
      />

      <Toast
        open={!isBot && ['unavailable', 'error', 'declined'].includes(pvpRematch.status)}
        tone={pvpRematch.status === 'unavailable' ? 'info' : 'error'}
        title={
          pvpRematch.status === 'unavailable'
            ? 'Rematch (Coming Soon)'
            : pvpRematch.status === 'declined'
              ? 'Rematch declined'
              : 'Rematch could not start'
        }
        onClose={pvpRematch.reset}
      >
        {pvpRematch.status === 'unavailable'
          ? 'The server does not offer PvP rematches yet.'
          : pvpRematch.status === 'declined'
            ? 'Your opponent declined the rematch.'
            : pvpRematch.error}
      </Toast>
      <Toast open={Boolean(botGame.error)} title="Rematch could not start" onClose={botGame.dismissError}>
        {botGame.error}
      </Toast>

      <Modal open={confirmResign} onClose={() => setConfirmResign(false)} labelledBy="resign-title">
        <h2 id="resign-title" className="text-lg font-bold text-slate-50">
          Resign this game?
        </h2>
        <p className="mt-2 text-sm text-slate-400">Your opponent will be awarded the win.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setConfirmResign(false)}>
            Keep playing
          </Button>
          <Button variant="danger" loading={resigning} onClick={confirmResignation}>
            Resign
          </Button>
        </div>
      </Modal>
    </div>
  )
}
