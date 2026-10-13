import { useId } from 'react'
import { cn } from '../../lib/cn'

export function Field({ label, error, hint, className, ...inputProps }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={cn(
          'h-11 w-full rounded-xl border bg-slate-950/50 px-3.5 text-sm text-slate-100 placeholder:text-slate-600',
          'transition-all duration-300 ease-out focus:outline-none focus:ring-4',
          error
            ? 'border-red-500/50 focus:border-red-400 focus:ring-red-500/10'
            : 'border-slate-800/80 hover:border-slate-700 focus:border-violet-400/70 focus:ring-violet-500/10',
        )}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
