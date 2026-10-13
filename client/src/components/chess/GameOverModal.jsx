import { cn } from '../../lib/cn'
import { resolveVerdict } from '../../lib/chess'
import { Button } from '../ui/Button'
import { Eyebrow } from '../ui/Card'
import { ChartIcon } from '../ui/Icons'
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

/** Appears the instant the server emits `game_over`; primary action launches the analysis dashboard. */
export function GameOverModal({ open, outcome, me, onAnalyze, onLobby, onDismiss }) {
  const verdict = VERDICTS[resolveVerdict(outcome, me)]

  return (
    <Modal open={open} onClose={onDismiss} labelledBy="gameover-title" className={cn('text-center', verdict.glow)}>
      <Eyebrow className="font-mono">{outcome?.status ?? 'game over'}</Eyebrow>
      <h2 id="gameover-title" className={cn('mt-3 text-4xl font-extrabold tracking-tight', verdict.tone)}>
        {verdict.title}
      </h2>
      {outcome?.message && <p className="mx-auto mt-3 max-w-xs text-sm text-slate-400">{outcome.message}</p>}

      <div className="mt-8 space-y-3">
        <Button size="lg" onClick={onAnalyze} className="w-full">
          <ChartIcon className="size-4" />
          Review tactical analysis
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onLobby}>
            Back to lobby
          </Button>
          <Button variant="ghost" onClick={onDismiss}>
            View board
          </Button>
        </div>
      </div>
    </Modal>
  )
}
