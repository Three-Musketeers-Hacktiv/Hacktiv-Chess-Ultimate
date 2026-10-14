import { cn } from '../../lib/cn'
import { describeOutcome, resolveVerdict } from '../../lib/chess'
import { eloSide } from '../../lib/elo'
import { ChartIcon, SearchIcon, SwordsIcon } from '../ui/Icons'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { EloChange } from './EloChange'

const PANEL =
  'w-full max-w-sm rounded-2xl border border-slate-800/80 bg-[#0F1524]/90 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl'

const REVIEW =
  'mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-medium tracking-wide text-emerald-400 transition-all duration-300 hover:border-emerald-500/40 hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]'

const REMATCH =
  'mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-xs font-medium tracking-wide text-indigo-400 transition-all duration-300 hover:border-indigo-500/40 hover:bg-indigo-500/20 hover:shadow-[0_0_15px_rgba(99,102,241,0.1)] disabled:pointer-events-none disabled:opacity-50'

const NEW_OPPONENT =
  'mb-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-xs font-medium tracking-wide text-slate-300 transition-all duration-300 hover:border-slate-700/80 hover:bg-slate-800/60'

const VIEW_BOARD =
  'mt-2 block text-xs font-medium tracking-wide text-slate-500 underline-offset-4 transition-colors duration-200 hover:text-slate-400 hover:underline'

const VERDICTS = {
  win: { title: 'Victory', tone: 'text-emerald-400' },
  loss: { title: 'Defeat', tone: 'text-white' },
  draw: { title: 'Draw', tone: 'text-white' },
}

/** `rematchStatus`: idle | starting (bot) | requesting | waiting | declined | error | unavailable | started */
const REMATCH_NOTES = {
  declined: { text: 'Your opponent declined the rematch.', tone: 'text-red-300/90' },
  unavailable: { text: 'Coming Soon', tone: 'text-slate-500/80' },
}

/**
 * Appears the instant the server emits `game_over`.
 * Shows the rating movement of a ranked game, then the actions: analysis (primary), rematch (socket),
 * find a new player (pure router navigation).
 */
export function GameOverModal({
  open,
  outcome,
  me,
  myColor,
  spectating,
  rematchStatus,
  rematchError,
  onRematch,
  onAnalyze,
  onNewOpponent,
  onDismiss,
}) {
  const verdict = VERDICTS[resolveVerdict(outcome, me)]
  const { reason, message } = describeOutcome(outcome)
  const waitingForOpponent = rematchStatus === 'requesting' || rematchStatus === 'waiting'
  const rematchBusy = waitingForOpponent || rematchStatus === 'starting' || rematchStatus === 'started'
  const rating = !spectating && outcome?.ranked ? eloSide(outcome.elo, myColor) : null
  const note = rematchStatus === 'error' ? { text: rematchError, tone: 'text-red-300/90' } : REMATCH_NOTES[rematchStatus]

  return (
    <Modal open={open} onClose={onDismiss} labelledBy="gameover-title" panelClassName={PANEL}>
      <p className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
        {reason}
        {outcome?.ranked ? ' · Ranked' : ''}
      </p>
      <h2 id="gameover-title" className={cn('mb-1 text-2xl font-bold tracking-tight', spectating ? 'text-white' : verdict.tone)}>
        {spectating ? 'Game over' : verdict.title}
      </h2>
      <p className="mb-6 text-xs font-normal text-slate-400">{message}</p>

      <EloChange side={rating} />

      <div className={rating ? 'mt-6' : undefined}>
        {!spectating && (
          <button type="button" onClick={onAnalyze} className={REVIEW}>
            <ChartIcon className="size-3.5" />
            Review tactical analysis
          </button>
        )}

        {!spectating && (
          <div>
            <button
              type="button"
              onClick={onRematch}
              disabled={rematchBusy}
              aria-busy={rematchBusy}
              className={cn(REMATCH, rematchStatus === 'unavailable' && 'opacity-70')}
            >
              {rematchBusy ? <Spinner className="size-3.5" /> : <SwordsIcon className="size-3.5" />}
              {waitingForOpponent
                ? 'Waiting for opponent acceptance...'
                : rematchBusy
                  ? 'Starting rematch...'
                  : 'Rematch'}
            </button>
            <span
              role="status"
              aria-live="polite"
              className={cn(
                'mb-3 block min-h-4 font-mono text-[11px] uppercase tracking-widest transition-opacity duration-300',
                note?.text ? 'opacity-100' : 'opacity-0',
                note?.tone,
              )}
            >
              {note?.text}
            </span>
          </div>
        )}

        <button type="button" onClick={onNewOpponent} className={NEW_OPPONENT}>
          <SearchIcon className="size-3.5" />
          Cari Player Baru
        </button>

        <button type="button" onClick={onDismiss} className={VIEW_BOARD}>
          View board
        </button>
      </div>
    </Modal>
  )
}
