import { Button } from '../ui/Button'
import { Eyebrow } from '../ui/Card'
import { SwordsIcon } from '../ui/Icons'
import { Modal } from '../ui/Modal'

/**
 * Shown to the side that receives `rematch_pending`. Like the draw offer it is deliberately not
 * dismissable by backdrop/Escape: it is answered with Accept (`request_rematch`) or Decline.
 */
export function RematchChallengeModal({ open, from, ranked, busy, onAccept, onDecline }) {
  return (
    <Modal open={open} labelledBy="rematch-challenge-title" className="text-center border-violet-500/40 shadow-glow-strong">
      <div className="relative mx-auto grid size-16 place-items-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full border border-violet-400/50" aria-hidden="true" />
        <span className="grid size-14 place-items-center rounded-full border border-violet-400/40 bg-violet-500/15 text-violet-200 shadow-glow">
          <SwordsIcon className="size-7" />
        </span>
      </div>

      <Eyebrow className="mt-5 font-mono">Rematch challenge{ranked ? ' · Ranked' : ''}</Eyebrow>
      <h2 id="rematch-challenge-title" className="mt-3 text-2xl font-extrabold tracking-tight text-slate-50">
        Opponent challenges you to a Rematch! Accept?
      </h2>
      <p className="mx-auto mt-3 max-w-xs text-sm text-slate-400">
        <span className="font-semibold text-violet-300">{from ?? 'Your opponent'}</span> wants to play again. Colors are
        swapped and the clocks start fresh{ranked ? '; the rating stakes stay on' : ''}.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="secondary" disabled={busy} onClick={onDecline}>
          Decline
        </Button>
        <Button variant="violet" loading={busy} onClick={onAccept}>
          Accept
        </Button>
      </div>
    </Modal>
  )
}
