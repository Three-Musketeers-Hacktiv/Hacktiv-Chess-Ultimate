import { useEffect } from 'react'
import { cn } from '../../lib/cn'

const tones = {
  info: 'border-violet-500/40 text-violet-100 shadow-glow',
  success: 'border-emerald-500/40 text-emerald-100 shadow-glow-emerald',
  error: 'border-red-500/40 text-red-100 shadow-glow-crimson',
}

/** Soft, self-dismissing notification pinned above everything (including modals). */
export function Toast({ open, tone = 'info', title, children, onClose, duration = 5000 }) {
  useEffect(() => {
    if (!open || !onClose) return undefined
    const id = setTimeout(onClose, duration)
    return () => clearTimeout(id)
  }, [open, onClose, duration])

  if (!open) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div
        role="status"
        className={cn(
          'pointer-events-auto flex max-w-md animate-pop items-start gap-3 rounded-xl border bg-slate-900/95 px-4 py-3 backdrop-blur-xl',
          'transition-all duration-300 ease-out hover:scale-[1.01]',
          tones[tone],
        )}
      >
        <div className="min-w-0 flex-1 text-sm">
          {title && <p className="font-semibold">{title}</p>}
          <p className={cn(title && 'mt-0.5 text-slate-300')}>{children}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="text-slate-400 transition-colors duration-300 hover:text-slate-100"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
