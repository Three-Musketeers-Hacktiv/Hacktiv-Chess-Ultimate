import { cn } from '../../lib/cn'

const tones = {
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  info: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
}

export function Alert({ tone = 'info', className, children }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('animate-pop rounded-xl border px-4 py-3 text-sm', tones[tone], className)}
    >
      {children}
    </div>
  )
}
