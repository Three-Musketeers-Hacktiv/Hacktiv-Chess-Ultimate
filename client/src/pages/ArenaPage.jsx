import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChessBoardPanel } from '../components/chess/ChessBoardPanel'
import { DrawClaimPanel } from '../components/chess/DrawClaimPanel'
import { DrawOfferModal } from '../components/chess/DrawOfferModal'
import { GameOverModal } from '../components/chess/GameOverModal'
import { MoveList } from '../components/chess/MoveList'
import { PlayerCard } from '../components/chess/PlayerCard'
import { PromotionPicker } from '../components/chess/PromotionPicker'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, Eyebrow } from '../components/ui/Card'
import { FlagIcon, SearchIcon } from '../components/ui/Icons'
import { Modal } from '../components/ui/Modal'
import { FullPageLoader } from '../components/ui/Spinner'
import { Toast } from '../components/ui/Toast'
import { useAuth } from '../hooks/useAuth'
import { useLiveGame } from '../hooks/useLiveGame'
import { useRematch } from '../hooks/useRematch'
import { useSocket } from '../hooks/useSocket'
import { cn } from '../lib/cn'
import { orientationOf } from '../lib/chess'
import { timeControlLabel } from '../lib/config'

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

  const { offerDraw } = game
  const sendDrawOffer = useCallback(async () => {
    setOffering(true)
    await offerDraw()
    setOffering(false)
  }, [offerDraw])

  const rematch = useRematch({ socket, roomId })

  // Leaving unmounts this session, which drops the chess.js instance and every piece of live-game state.
  const goLobby = useCallback(() => navigate('/lobby'), [navigate])
  const openAnalysis = useCallback(() => navigate('/analysis', { state: { pgn: getPgn() } }), [navigate, getPgn])
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
    <div className="grid animate-rise gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      {/* ───────── Board column ───────── */}
      <section className="mx-auto w-full max-w-[min(100%,calc(100dvh-15rem))] space-y-3" aria-label="Chess board">
        <PlayerCard
          name={nameOf(topColor)}
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
          <Eyebrow>{info.status === 'waiting' ? 'Room open' : 'Live match'}</Eyebrow>
          <StatusPill
            outcome={outcome}
            status={info.status}
            isMyTurn={game.isMyTurn}
            isCheck={game.isCheck}
            spectating={spectating}
          />
          {info.status === 'waiting' && (
            <p className="text-sm text-slate-400">
              Your room is listed in the lobby. The game starts automatically as soon as a rival joins.
            </p>
          )}
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

        <div className="flex gap-3">
          {outcome ? (
            <>
              {!spectating && (
                <Button className="flex-1" onClick={openAnalysis}>
                  Review analysis
                </Button>
              )}
              <Button variant="secondary" className={spectating ? 'flex-1' : undefined} onClick={goLobby}>
                <SearchIcon className="size-4" />
                Cari Player Baru
              </Button>
            </>
          ) : live && !spectating ? (
            <>
              <Button
                variant="secondary"
                className="flex-1"
                loading={offering}
                disabled={offering || Boolean(game.drawOffer) || game.moves.length < 2}
                title={game.moves.length < 2 ? 'Available once both players have moved' : undefined}
                onClick={sendDrawOffer}
              >
                <span aria-hidden="true" className="font-mono text-base leading-none">
                  ½
                </span>
                Offer Draw
              </Button>
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
        spectating={spectating}
        rematchStatus={rematch.status}
        rematchSupported={rematch.supported}
        onRematch={rematch.request}
        onAnalyze={openAnalysis}
        onNewOpponent={goLobby}
        onDismiss={closeOver}
      />

      <Toast
        open={rematch.status === 'unavailable'}
        title="Fitur Rematch (Coming Soon)"
        onClose={rematch.reset}
      >
        Sedang dikembangkan oleh Backend.
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
