import { useEffect } from 'react'
import { cn } from '../../lib/cn'

/** Lightweight accessible modal. Closes on Escape and backdrop click when `onClose` is provided. */
export function Modal({ open, onClose, labelledBy, className, children }) {
  useEffect(() => {
    if (!open || !onClose) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0 animate-fade bg-obsidian/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'relative w-full max-w-md animate-pop rounded-2xl border border-slate-800/60 bg-slate-900/90 p-6 shadow-glow-strong backdrop-blur-2xl',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
