import { cn } from '../../lib/cn'

/** Muted-slate obsidian panel with a fine brushed border and soft amethyst glow. */
export function Card({ as: Tag = 'div', glass = false, interactive = false, className, ...props }) {
  return (
    <Tag
      className={cn(
        'rounded-2xl border border-slate-800/60 shadow-glow',
        glass ? 'bg-slate-900/40 backdrop-blur-2xl' : 'bg-slate-900/60 backdrop-blur-xl',
        interactive &&
          'transition-all duration-300 ease-out hover:scale-[1.01] hover:border-slate-700/80 hover:shadow-glow-strong active:scale-[0.99]',
        className,
      )}
      {...props}
    />
  )
}

export function Eyebrow({ className, ...props }) {
  return (
    <p
      className={cn('font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500', className)}
      {...props}
    />
  )
}
