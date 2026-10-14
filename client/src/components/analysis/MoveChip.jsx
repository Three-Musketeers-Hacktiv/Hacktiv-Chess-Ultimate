import { memo, useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { revealInside } from '../../lib/scroll'
import { ArrowRightIcon, ChevronIcon } from '../ui/Icons'
import { EvalMeter } from './EvalMeter'

/**
 * One structured review row: move → classification chip → evaluation, plus — for a Mistake or Blunder — a
 * collapsible box with Stockfish's better move underneath. The box opens by itself for the selected move
 * and can be toggled by hand.
 */
export const MoveChip = memo(function MoveChip({ item, index, active, onSelect }) {
  const ref = useRef(null)
  const { tone } = item
  const [manual, setManual] = useState(null) // null → follow `active`
  const hasSuggestion = Boolean(item.bestAlternative) && (tone.key === 'mistake' || tone.key === 'blunder')
  const expanded = hasSuggestion && (manual ?? active)

  useEffect(() => {
    if (active) revealInside(ref.current)
  }, [active])

  const notation = `${item.moveNumber}${item.color === 'b' ? '…' : '.'}${item.san}`
  const lostPawns = item.centipawnLoss != null ? (item.centipawnLoss / 100).toFixed(1) : null

  return (
    <li>
      <button
        ref={ref}
        type="button"
        data-active={active}
        onClick={() => onSelect(index)}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'group w-full border border-slate-800/60 bg-slate-900/40 px-4 py-3 text-left',
          hasSuggestion && expanded ? 'rounded-t-xl' : 'rounded-xl',
          'transition-all duration-300 ease-out hover:bg-slate-900/80 active:scale-[0.99]',
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
          {item.evaluation != null && <EvalMeter value={item.evaluation} />}
        </div>
      </button>

      {hasSuggestion && (
        <div className={cn('-mt-px border-x border-b px-4 transition-all duration-300 ease-out', tone.panel, expanded ? 'rounded-b-xl' : 'rounded-b-xl border-t')}>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setManual(!expanded)}
            className="flex w-full items-center gap-2 py-2 text-left font-mono text-[11px] uppercase tracking-widest text-slate-400 transition-colors duration-300 hover:text-slate-200"
          >
            <ChevronIcon className={cn('size-3.5 transition-transform duration-300', expanded && 'rotate-90')} />
            Stockfish suggests
            {!expanded && (
              <span className="ml-auto font-semibold normal-case tracking-normal text-slate-300">{item.bestAlternative}</span>
            )}
          </button>
          <div
            className={cn(
              'grid transition-all duration-300 ease-out',
              expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 pb-3 text-xs text-slate-400">
                <span className="uppercase tracking-widest text-slate-500">Better</span>
                <ArrowRightIcon className="size-3.5 text-emerald-400" />
                <span className="rounded-md border border-emerald-800/40 bg-emerald-950/30 px-2 py-0.5 font-mono text-[13px] font-semibold text-emerald-400">
                  {item.bestAlternative}
                </span>
                {lostPawns != null && (
                  <span className="ml-auto font-mono text-slate-500">cost you ~{lostPawns} pawns</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  )
})
