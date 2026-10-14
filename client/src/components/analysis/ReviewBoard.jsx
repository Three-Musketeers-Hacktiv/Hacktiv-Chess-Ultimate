import { useMemo } from 'react'
import { START_FEN, orientationOf } from '../../lib/chess'
import { cn } from '../../lib/cn'
import { ChessBoardPanel } from '../chess/ChessBoardPanel'
import { Button } from '../ui/Button'
import { ChevronIcon } from '../ui/Icons'

const EMERALD = '#10B981'

/** Chess.com-style marker. Purely visual (`pointer-events-none`), so it never swallows a board click. */
function TacticalBadge({ badge, label }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        'pointer-events-none absolute -right-2 -top-2 z-50 flex h-8 w-8 select-none items-center justify-center rounded-full',
        'font-sans text-base font-black leading-none text-white shadow-[0_4px_10px_rgba(0,0,0,0.6)] transition-all duration-200 animate-fade-in',
        badge.className,
      )}
    >
      {badge.icon}
    </span>
  )
}

/**
 * Read-only board for the move selected in the timeline: shows the position AFTER the move, marks the
 * destination square with its classification badge and — for a Mistake/Blunder — draws Stockfish's
 * suggested alternative as an emerald arrow.
 */
export function ReviewBoard({ item, color, index, total, onPrev, onNext }) {
  const playedMove = item?.playedMove ?? null
  const alternative = item?.alternativeMove ?? null
  const toneKey = item?.tone.key

  // Only re-derived when the selected move changes, so the memoised board skips every other render.
  const arrows = useMemo(() => {
    if (!alternative || (toneKey !== 'mistake' && toneKey !== 'blunder')) return []
    return [{ startSquare: alternative.from, endSquare: alternative.to, color: EMERALD }]
  }, [alternative, toneKey])

  const badge = useMemo(() => {
    const spec = item?.tone.badge
    if (!spec || !playedMove) return null
    return {
      square: playedMove.to,
      content: <TacticalBadge key={item.key} badge={spec} label={item.tone.text} />,
    }
  }, [item, playedMove])

  return (
    <div className="space-y-3">
      <ChessBoardPanel
        fen={item?.fenAfter ?? START_FEN}
        orientation={orientationOf(color)}
        arrows={arrows}
        badge={badge}
      />

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={onPrev} disabled={index <= 0} aria-label="Previous move">
          <ChevronIcon dir="left" className="size-4" />
          Prev
        </Button>
        <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
          Move <span className="text-slate-200">{total ? index + 1 : 0}</span> / {total}
        </p>
        <Button variant="secondary" size="sm" onClick={onNext} disabled={index >= total - 1} aria-label="Next move">
          Next
          <ChevronIcon className="size-4" />
        </Button>
      </div>

      <p className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded bg-emerald-500" /> Stockfish suggests
        </span>
      </p>
    </div>
  )
}
