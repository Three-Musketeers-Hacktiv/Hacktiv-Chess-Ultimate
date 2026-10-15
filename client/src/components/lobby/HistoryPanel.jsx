import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAbortable } from '../../hooks/useAbortable'
import { useAuth } from '../../hooks/useAuth'
import { profileApi } from '../../lib/api'
import { cn } from '../../lib/cn'
import { eloSide, eloTrend, formatEloChange } from '../../lib/elo'
import { lastGame } from '../../lib/storage'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'

const VERDICT = {
  win: { label: 'WIN', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  loss: { label: 'LOSS', className: 'border-red-500/30 bg-red-500/10 text-vermillion' },
  draw: { label: 'DRAW', className: 'border-slate-600/40 bg-slate-700/20 text-slate-300' },
}

const ELO_TONE = {
  up: 'text-emerald-300',
  down: 'text-vermillion',
  even: 'text-slate-400',
}

/** Result from this player's colour: `1-0` with White is a win, etc. */
function verdictOf(result, color) {
  if (!result || result === '*' || result === '1/2-1/2') return 'draw'
  if (result === '1-0') return color === 'w' ? 'win' : 'loss'
  if (result === '0-1') return color === 'b' ? 'win' : 'loss'
  return 'draw'
}

function opponentLabel(game) {
  if (game.mode === 'bot' || /^stockfish/i.test(game.opponent ?? '')) {
    return game.opponent || 'Stockfish'
  }
  return game.opponent || 'Opponent'
}

function HistoryRow({ game, me, onReview }) {
  const verdict = VERDICT[verdictOf(game.result, game.color)]
  const change = eloSide(game.elo, game.color)?.change
  const eloLabel = formatEloChange(change)

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-950/40 px-4 py-3">
      <span
        className={cn(
          'inline-flex min-w-14 items-center justify-center rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest',
          verdict.className,
        )}
      >
        {verdict.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">{opponentLabel(game)}</p>
        <p className="font-mono text-[11px] uppercase tracking-widest text-slate-500">
          {game.mode === 'bot' ? 'vs Stockfish' : 'vs Player'}
          {game.color === 'w' ? ' · White' : ' · Black'}
        </p>
      </div>
      {eloLabel && (
        <span className={cn('font-mono text-xs font-semibold tabular-nums', ELO_TONE[eloTrend(change)])}>
          {eloLabel}
        </span>
      )}
      <Button size="sm" variant="secondary" onClick={() => onReview(game, me)}>
        Review
      </Button>
    </li>
  )
}

/**
 * Finished games of the signed-in player (`GET /api/profile/me`). Opens only while `open` is true so
 * the request starts on click and is aborted if the panel is closed.
 */
export function HistoryPanel({ open, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const nextSignal = useAbortable()
  const [status, setStatus] = useState('idle')
  const [games, setGames] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setStatus('loading')
    setError('')
    profileApi
      .me(nextSignal())
      .then((data) => {
        if (cancelled) return
        setGames(Array.isArray(data?.profile?.games) ? data.profile.games : [])
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return
        setError(err.message)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [open, nextSignal])

  const review = (game, me) => {
    const verdict = verdictOf(game.result, game.color)
    lastGame.set({
      gameId: game.id,
      pgn: game.pgn,
      color: game.color,
      me,
      opponent: { username: opponentLabel(game) },
      outcome: {
        result: game.result,
        winner: verdict === 'win' ? me : verdict === 'loss' ? opponentLabel(game) : null,
        termination_reason: game.termination_reason,
      },
      endedAt: game.ended_at,
    })
    onClose()
    navigate('/analysis', { state: { pgn: game.pgn, gameId: game.id } })
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="history-title" className="max-h-[80vh] max-w-2xl! overflow-hidden">
      <h2 id="history-title" className="text-lg font-bold tracking-tight text-slate-50">
        Game history
      </h2>
      <p className="mt-1 text-sm text-slate-400">Finished matches, newest first. Review opens Stockfish analysis.</p>

      <div className="mt-5 max-h-[400px] overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {status === 'loading' && (
          <p className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-violet-300">
            <Spinner className="size-4" /> Loading games…
          </p>
        )}
        {status === 'error' && <Alert tone="error">{error}</Alert>}
        {status === 'ready' && games.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-800/80 px-4 py-8 text-center text-sm text-slate-500">
            No finished games yet. Play a match and it will land here.
          </p>
        )}
        {status === 'ready' && games.length > 0 && (
          <ul className="space-y-2">
            {games.map((game) => (
              <HistoryRow key={game.id} game={game} me={user?.username} onReview={review} />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
