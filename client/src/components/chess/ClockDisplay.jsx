import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'

function format(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Server clocks are snapshots (`white_ms`, `black_ms`, `active_color`). Between snapshots the active
 * side's clock is interpolated locally — in this component only, so the board never re-renders per tick.
 */
export function ClockDisplay({ clocks, color }) {
  const [now, setNow] = useState(() => performance.now())
  const running = clocks?.active_color === color

  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(id)
  }, [running, clocks])

  if (!clocks) return null

  const base = color === 'w' ? clocks.white_ms : clocks.black_ms
  if (typeof base !== 'number') return null

  const elapsed = running ? Math.max(0, now - clocks.receivedAt) : 0
  const remaining = base - elapsed
  const low = remaining <= 20_000

  return (
    <span
      className={cn(
        'rounded-lg border px-3 py-1.5 font-mono text-lg font-semibold tabular-nums transition-colors duration-300',
        running ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-slate-800/60 bg-slate-950/40 text-slate-400',
        low && 'border-red-500/40 bg-red-500/10 text-red-300',
      )}
      aria-label={`${color === 'w' ? 'White' : 'Black'} clock`}
    >
      {format(remaining)}
    </span>
  )
}
