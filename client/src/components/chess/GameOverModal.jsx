import { cn } from '../../lib/cn'
import { describeOutcome, resolveVerdict } from '../../lib/chess'
import { Button } from '../ui/Button'
import { Eyebrow } from '../ui/Card'
import { ChartIcon, SearchIcon, SwordsIcon } from '../ui/Icons'
import { Modal } from '../ui/Modal'

const VERDICTS = {
  win: {
    title: 'Victory',
    tone: 'text-emerald-300',
    glow: 'shadow-glow-emerald border-emerald-500/30',
  },
  loss: {
    title: 'Defeat',
    tone: 'text-red-300',
    glow: 'shadow-glow-crimson border-red-500/30',
  },
  draw: {
    title: 'Draw',
    tone: 'text-slate-200',
    glow: 'shadow-glow border-slate-700/60',
  },
}

/**
 * Appears the instant the server emits `game_over`.
 * Actions: analysis (primary), rematch (socket), find a new player (pure router navigation).
 */
export function GameOverModal({
  open,
  outcome,
  me,
  spectating,
  rematchStatus,
  rematchSupported,
  onRematch,
  onAnalyze,
  onNewOpponent,
  onDismiss,
}) {
  const verdict = VERDICTS[resolveVerdict(outcome, me)]
  const { reason, message } = describeOutcome(outcome)
  const rematchBusy = rematchStatus === 'requesting' || rematchStatus === 'waiting'

  return (
    <Modal open={open} onClose={onDismiss} labelledBy="gameover-title" className={cn('text-center', verdict.glow)}>
      <Eyebrow className="font-mono">{reason}</Eyebrow>
      <h2 id="gameover-title" className={cn('mt-3 text-4xl font-extrabold tracking-tight', verdict.tone)}>
        {spectating ? 'Game over' : verdict.title}
      </h2>
      <p className="mx-auto mt-3 max-w-xs text-sm text-slate-400">{message}</p>

      <div className="mt-8 space-y-3">
        {!spectating && (
          <Button size="lg" onClick={onAnalyze} className="w-full">
            <ChartIcon className="size-4" />
            Review tactical analysis
          </Button>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!spectating && (
            <div className="flex flex-col items-stretch gap-1">
              <Button
                variant="violet"
                loading={rematchBusy}
                onClick={onRematch}
                disabled={rematchBusy}
                className={cn(!rematchSupported && 'opacity-70')}
              >
                {!rematchBusy && <SwordsIcon className="size-4" />}
                {rematchStatus === 'waiting' ? 'Menunggu lawan' : 'Tantang Lagi (Rematch)'}
              </Button>
              {!rematchSupported && (
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500/80">Coming Soon</span>
              )}
            </div>
          )}
          <Button variant="secondary" onClick={onNewOpponent} className={spectating ? 'col-span-2' : undefined}>
            <SearchIcon className="size-4" />
            Cari Player Baru
          </Button>
        </div>

        <Button variant="ghost" onClick={onDismiss} className="w-full">
          View board
        </Button>
      </div>
    </Modal>
  )
}
