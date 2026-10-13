import { useCallback, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChessBoardPanel } from '../components/chess/ChessBoardPanel'
import { GameOverModal } from '../components/chess/GameOverModal'
import { MoveList } from '../components/chess/MoveList'
import { PlayerCard } from '../components/chess/PlayerCard'
import { PromotionPicker } from '../components/chess/PromotionPicker'
import { Button } from '../components/ui/Button'
import { Card, Eyebrow } from '../components/ui/Card'
import { FlagIcon } from '../components/ui/Icons'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'
import { useChessGame } from '../hooks/useChessGame'
import { useSocket } from '../hooks/useSocket'
import { cn } from '../lib/cn'
import { orientationOf } from '../lib/chess'

/** Route shell: validates the `game_started` payload handed over by the lobby. */
export default function ArenaPage() {
  const { roomId } = useParams()
  const { state } = useLocation()
  const session = state?.session

  if (!session || session.room_id !== roomId) return <Navigate to="/lobby" replace />
  return <ArenaSession key={roomId} session={session} />
}

function StatusPill({ outcome, isMyTurn, isCheck }) {
  let tone = 'border-slate-700/60 bg-slate-800/50 text-slate-300'
  let label = "Opponent's move"

  if (outcome) {
    label = 'Game over'
    tone = 'border-slate-600/60 bg-slate-800/60 text-slate-200'
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
      <span className={cn('size-1.5 rounded-full bg-current', isMyTurn && !outcome && 'animate-sheen')} />
      {label}
    </span>
  )
}

function ArenaSession({ session }) {
  const { user } = useAuth()
  const { socket, resetConnection } = useSocket()
  const navigate = useNavigate()
  const me = user?.username ?? 'You'
  const myColor = session.color
  const opponent = session.opponent ?? { username: 'Opponent' }

  const game = useChessGame({ socket, session, me })
  const { outcome, getPgn } = game

  const [dismissedOver, setDismissedOver] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const goLobby = useCallback(() => navigate('/lobby'), [navigate])
  const openAnalysis = useCallback(() => navigate('/analysis', { state: { pgn: getPgn() } }), [navigate, getPgn])
  const closeOver = useCallback(() => setDismissedOver(true), [])

  const leave = () => {
    if (!outcome) resetConnection() // abandoning a live game: drop the transport so the server sees us leave
    goLobby()
  }

  const opponentColor = myColor === 'w' ? 'b' : 'w'

  return (
    <div className="grid animate-rise gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      {/* ───────── Board column ───────── */}
      <section className="mx-auto w-full max-w-[min(100%,calc(100dvh-15rem))] space-y-3" aria-label="Chess board">
        <PlayerCard
          name={opponent.username}
          rating={opponent.rating}
          color={opponentColor}
          active={!outcome && game.turn === opponentColor}
        />

        <ChessBoardPanel
          fen={game.fen}
          orientation={orientationOf(myColor)}
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

        <PlayerCard name={me} color={myColor} active={game.isMyTurn} isYou />
      </section>

      {/* ───────── Side panel ───────── */}
      <aside className="flex min-h-0 flex-col gap-4 lg:max-h-[calc(100dvh-8rem)]">
        <Card className="space-y-4 p-5">
          <Eyebrow>Live match</Eyebrow>
          <StatusPill outcome={outcome} isMyTurn={game.isMyTurn} isCheck={game.isCheck} />
          <div className="grid grid-cols-2 gap-3 font-mono text-xs">
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2">
              <p className="uppercase tracking-widest text-slate-600">Playing</p>
              <p className="mt-1 text-sm text-slate-200">{myColor === 'w' ? 'White' : 'Black'}</p>
            </div>
            <div className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2">
              <p className="uppercase tracking-widest text-slate-600">Move</p>
              <p className="mt-1 text-sm tabular-nums text-slate-200">{Math.floor(game.moves.length / 2) + 1}</p>
            </div>
          </div>
        </Card>

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
            <Button className="flex-1" onClick={openAnalysis}>
              Review analysis
            </Button>
          ) : (
            <Button variant="danger" className="flex-1" onClick={() => setConfirmLeave(true)}>
              <FlagIcon className="size-4" />
              Leave match
            </Button>
          )}
          {outcome && (
            <Button variant="secondary" onClick={goLobby}>
              Lobby
            </Button>
          )}
        </div>
      </aside>

      {/* ───────── Overlays ───────── */}
      <PromotionPicker
        open={Boolean(game.pendingPromotion)}
        color={myColor}
        onSelect={game.choosePromotion}
        onCancel={game.cancelPromotion}
      />

      <GameOverModal
        open={Boolean(outcome) && !dismissedOver}
        outcome={outcome}
        me={me}
        onAnalyze={openAnalysis}
        onLobby={goLobby}
        onDismiss={closeOver}
      />

      <Modal open={confirmLeave} onClose={() => setConfirmLeave(false)} labelledBy="leave-title">
        <h2 id="leave-title" className="text-lg font-bold text-slate-50">
          Leave this match?
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Your realtime connection for this game will be closed and you will return to the lobby.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
            Stay
          </Button>
          <Button variant="danger" onClick={leave}>
            Leave
          </Button>
        </div>
      </Modal>
    </div>
  )
}
