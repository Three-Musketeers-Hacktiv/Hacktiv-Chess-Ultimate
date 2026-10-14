import { useSocket } from '../../hooks/useSocket'
import { cn } from '../../lib/cn'

const STATES = {
  connected: { label: 'Live', dot: 'bg-emerald-400', text: 'text-emerald-300', pulse: true },
  connecting: { label: 'Linking', dot: 'bg-amber-400', text: 'text-amber-300', pulse: true },
  disconnected: { label: 'Offline', dot: 'bg-slate-500', text: 'text-slate-400', pulse: false },
  error: { label: 'Unreachable', dot: 'bg-vermillion', text: 'text-red-300', pulse: false },
  idle: { label: 'Idle', dot: 'bg-slate-600', text: 'text-slate-500', pulse: false },
}

/** Isolated so a transport flap re-renders only this pill, never the page content. */
export function ConnectionBadge() {
  const { status } = useSocket()
  const state = STATES[status] ?? STATES.idle

  return (
    <span
      className={cn(
        'hidden items-center gap-2 rounded-full border border-slate-800/60 bg-slate-900/60 px-3 py-1.5 sm:inline-flex',
        'font-mono text-[11px] uppercase tracking-widest transition-colors duration-300',
        state.text,
      )}
      role="status"
      aria-label={`Realtime connection: ${state.label}`}
    >
      <span className="relative flex size-2">
        {state.pulse && <span className={cn('absolute inset-0 animate-pulse-ring rounded-full', state.dot)} />}
        <span className={cn('relative size-2 rounded-full', state.dot)} />
      </span>
      {state.label}
    </span>
  )
}
