import { useEffect } from 'react'
import { cn } from '../../lib/cn'

const PANEL =
  'w-full max-w-md rounded-2xl border border-slate-800/60 bg-slate-900/90 p-6 shadow-glow-strong backdrop-blur-2xl'

/** Lightweight accessible modal. Closes on Escape and backdrop click when `onClose` is provided. */
export function Modal({ open, onClose, labelledBy, className, panelClassName, children }) {
  useEffect(() => {
    if (!open || !onClose) return undefined
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Freeze the page behind the overlay so wheel/trackpad never scrolls the dashboard.
  useEffect(() => {
    if (!open) return undefined
    const { overflow, paddingRight } = document.body.style
    const gap = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (gap > 0) document.body.style.paddingRight = `${gap}px`
    return () => {
      document.body.style.overflow = overflow
      document.body.style.paddingRight = paddingRight
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-hidden overscroll-none p-4">
      <div
        className="absolute inset-0 animate-fade bg-obsidian/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn('relative animate-pop', panelClassName ?? PANEL, className)}
      >
        {children}
      </div>
    </div>
  )
}
