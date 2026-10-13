import { memo } from 'react'
import { cn } from '../../lib/cn'

/** Compact player strip above/below the board. Emerald glow marks whose turn it is. */
export const PlayerCard = memo(function PlayerCard({ name, rating, color, active, isYou }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-slate-900/60 px-4 py-3 backdrop-blur-xl',
        'transition-all duration-300 ease-out',
        active
          ? 'border-emerald-500/40 shadow-glow-emerald'
          : 'border-slate-800/60 shadow-glow',
      )}
    >
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-lg border font-mono text-sm font-bold uppercase transition-colors duration-300',
          color === 'w'
            ? 'border-slate-300/30 bg-slate-100 text-slate-900'
            : 'border-slate-600/50 bg-slate-950 text-slate-200',
        )}
        aria-hidden="true"
      >
        {name?.[0] ?? '?'}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-100">
          {name}
          {isYou && (
            <span className="rounded-md border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-300">
              You
            </span>
          )}
        </p>
        <p className="font-mono text-xs text-slate-500">{color === 'w' ? 'White' : 'Black'}</p>
      </div>

      {rating != null && (
        <span className="font-mono text-sm tabular-nums text-slate-400">{rating}</span>
      )}

      <span
        className={cn(
          'size-2.5 rounded-full transition-all duration-300',
          active ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)]' : 'bg-slate-700',
        )}
        aria-label={active ? 'To move' : undefined}
      />
    </div>
  )
})
