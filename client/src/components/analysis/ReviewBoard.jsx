import { useMemo } from 'react'
import { START_FEN, orientationOf } from '../../lib/chess'
import { ChessBoardPanel } from '../chess/ChessBoardPanel'
import { Button } from '../ui/Button'
import { ChevronIcon } from '../ui/Icons'

const EMERALD = '#10B981'

/** Read-only replay of the selected move, with played/best-alternative arrows. */
export function ReviewBoard({ item, color, index, total, onPrev, onNext }) {
  const arrows = useMemo(() => {
    if (!item) return []
    const list = []
    const alt = item.alternativeMove
    if (alt) list.push({ startSquare: alt.from, endSquare: alt.to, color: EMERALD })
    if (item.playedMove && item.tone.key !== 'best') {
      list.push({ startSquare: item.playedMove.from, endSquare: item.playedMove.to, color: item.tone.arrow })
    } else if (item.playedMove && !alt) {
      list.push({ startSquare: item.playedMove.from, endSquare: item.playedMove.to, color: EMERALD })
    }
    return list
  }, [item])

  return (
    <div className="space-y-3">
      <ChessBoardPanel
        fen={item?.fenBefore ?? START_FEN}
        orientation={orientationOf(color)}
        arrows={arrows}
        lastMove={null}
      />

      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="sm" onClick={onPrev} disabled={index <= 0} aria-label="Previous move">
          <ChevronIcon dir="left" className="size-4" />
          Prev
        </Button>
        <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
          Before move <span className="text-slate-200">{total ? index + 1 : 0}</span> / {total}
        </p>
        <Button variant="secondary" size="sm" onClick={onNext} disabled={index >= total - 1} aria-label="Next move">
          Next
          <ChevronIcon className="size-4" />
        </Button>
      </div>

      <p className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded bg-emerald-500" /> Best / suggested
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded bg-vermillion" /> Played
        </span>
      </p>
    </div>
  )
}
