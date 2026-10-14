import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { eloTrend, formatEloChange } from '../../lib/elo'

const TONES = {
  up: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-glow-emerald',
  down: 'border-red-500/40 bg-red-500/10 text-red-300 shadow-glow-crimson',
  even: 'border-slate-600/60 bg-slate-800/60 text-slate-200 shadow-glow',
}
const RING = { up: 'border-emerald-400/50', down: 'border-red-400/50', even: 'border-slate-400/40' }

const COUNT_MS = 700
const easeOut = (t) => 1 - (1 - t) ** 3

/** Counts from 0 to `target`; lands on the exact value (and skips the motion for reduced-motion users). */
function useCountUp(target) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (typeof target !== 'number') return undefined
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const startedAt = performance.now()
    let frame = 0
    const tick = (now) => {
      const progress = reduce ? 1 : Math.min(1, (now - startedAt) / COUNT_MS)
      setValue(Math.round(target * easeOut(progress)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target])

  return typeof target === 'number' ? value : null
}

/**
 * The rating movement of a finished ranked game: `+16 ELO` (emerald) / `-14 ELO` (crimson) with the
 * `before → after` rating underneath. `side` is the player's `{ before, change, after }` from the server.
 */
export function EloChange({ side }) {
  const shown = useCountUp(side?.change)
  if (!side || typeof side.change !== 'number') return null

  const trend = eloTrend(side.change)

  return (
    <div
      className={cn('relative mx-auto mt-6 w-fit animate-pop rounded-2xl border px-6 py-3 transition-colors duration-500', TONES[trend])}
      role="status"
      aria-label={`Rating change ${formatEloChange(side.change)}`}
    >
      <span
        className={cn('pointer-events-none absolute inset-0 animate-pulse-ring rounded-2xl border', RING[trend])}
        aria-hidden="true"
      />
      <p className="font-mono text-3xl font-extrabold tabular-nums tracking-tight">{formatEloChange(shown)}</p>
      <p className="mt-1 font-mono text-xs uppercase tracking-widest text-slate-400">
        {side.before} <span aria-hidden="true">→</span> <span className="text-slate-100">{side.after}</span>
      </p>
    </div>
  )
}
