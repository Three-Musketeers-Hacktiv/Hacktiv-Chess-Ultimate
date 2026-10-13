import { memo, useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { revealInside } from '../../lib/scroll'
import { ArrowRightIcon } from '../ui/Icons'
import { EvalMeter } from './EvalMeter'

/** One structured review row: move → classification chip → evaluation → better suggestion. */
export const MoveChip = memo(function MoveChip({ item, index, active, onSelect }) {
  const ref = useRef(null)
  const { tone } = item

  useEffect(() => {
    if (active) revealInside(ref.current)
  }, [active])

  const notation = `${item.moveNumber}${item.color === 'b' ? '…' : '.'}${item.san}`

  return (
    <li>
      <button
        ref={ref}
        type="button"
        data-active={active}
        onClick={() => onSelect(index)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'group w-full rounded-xl border border-slate-800/60 bg-slate-900/40 px-4 py-3 text-left',
          'transition-all duration-300 ease-out hover:scale-[1.01] hover:bg-slate-900/80 active:scale-[0.99]',
          'data-[active=true]:bg-slate-900/90',
          tone.ring,
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn('size-2 shrink-0 rounded-full', tone.dot)} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold text-slate-100">{notation}</span>
          <span
            className={cn(
              'rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider',
              tone.chip,
            )}
          >
            {tone.text}
          </span>
          <EvalMeter value={item.evaluation} />
        </div>

        {item.bestAlternative && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-slate-800/60 pt-2.5 text-xs text-slate-400">
            <span className="uppercase tracking-widest text-slate-500">Better</span>
            <ArrowRightIcon className="size-3.5 text-emerald-400" />
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[13px] font-semibold text-emerald-300">
              {item.bestAlternative}
            </span>
          </div>
        )}
      </button>
    </li>
  )
})
