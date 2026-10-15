import { cn } from '../../lib/cn'
import { Spinner } from './Spinner'

const base =
  'relative inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold tracking-tight ' +
  'transition-all duration-300 ease-out hover:scale-[1.01] active:scale-[0.99] ' +
  'disabled:pointer-events-none disabled:opacity-50'

const variants = {
  primary:
    'border border-emerald-400/30 bg-emerald-500 text-emerald-950 shadow-glow-emerald hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.35)]',
  violet:
    'border border-violet-400/30 bg-violet-500/90 text-white shadow-glow hover:bg-violet-500 hover:shadow-glow-strong',
  secondary:
    'border border-slate-700/70 bg-slate-800/60 text-slate-200 hover:border-slate-600 hover:bg-slate-800',
  ghost: 'border border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-100',
  danger:
    'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:shadow-glow-crimson',
}

const sizes = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
