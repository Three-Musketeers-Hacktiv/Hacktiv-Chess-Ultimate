import { memo } from 'react'
import { cn } from '../../lib/cn'

/**
 * One selectable tile (radio semantics) with a thumbnail and a green check while active.
 * `onSelect(value)` receives `value` back, so a parent can pass one stable handler to every tile.
 */
export const ChoiceCard = memo(function ChoiceCard({ value, label, active, onSelect, children, className }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => onSelect(value)}
      className={cn(
        'group relative rounded-xl border p-2 text-center transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
        active
          ? 'border-emerald-400/60 bg-emerald-500/10 shadow-glow-emerald'
          : 'border-slate-800/70 bg-slate-900/40 hover:border-slate-600/80 hover:bg-slate-800/50',
        className,
      )}
    >
      <span className="block overflow-hidden rounded-lg transition-transform duration-200 ease-out group-hover:scale-[1.03]">{children}</span>
      {active && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] text-white shadow"
        >
          ✓
        </span>
      )}
      <span
        className={cn(
          'block py-1 text-center text-[10px] font-bold uppercase tracking-wider tracking-widest sm:text-xs',
          active ? 'text-emerald-300' : 'text-slate-400',
        )}
      >
        {label}
      </span>
    </button>
  )
})
