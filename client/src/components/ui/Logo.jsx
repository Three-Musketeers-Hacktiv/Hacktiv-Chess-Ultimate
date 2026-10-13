import { cn } from '../../lib/cn'

export function LogoMark({ className }) {
  return (
    <span
      className={cn(
        'grid size-9 place-items-center rounded-xl border border-slate-700/60 bg-linear-to-br from-violet-500/25 to-emerald-500/15 shadow-glow',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5 text-violet-200" fill="currentColor" aria-hidden="true">
        <path d="M12 3a3 3 0 0 0-3 3c0 .9.4 1.7 1 2.2C8.8 9 7.5 10.9 7.5 13c0 1.1.4 2.1 1 2.9L7 19h10l-1.5-3.1c.6-.8 1-1.8 1-2.9 0-2.1-1.3-4-3.5-4.8.6-.5 1-1.3 1-2.2a3 3 0 0 0-3-3Z" />
        <rect x="6" y="19.5" width="12" height="1.8" rx=".9" />
      </svg>
    </span>
  )
}

export function Wordmark({ className }) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <LogoMark />
      <span className="leading-none">
        <span className="block text-[15px] font-extrabold tracking-tight text-slate-100">Hacktiv Chess</span>
        <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.35em] text-violet-300/80">Ultimate</span>
      </span>
    </span>
  )
}
