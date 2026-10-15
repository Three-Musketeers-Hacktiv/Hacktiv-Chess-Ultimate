import { memo, useEffect, useMemo, useRef } from 'react'
import { cn } from '../../lib/cn'
import { revealInside } from '../../lib/scroll'

/** Scoreboard-style SAN list in monospace, auto-following the latest move. */
export const MoveList = memo(function MoveList({ moves }) {
  const endRef = useRef(null)

  const rows = useMemo(() => {
    const out = []
    for (let i = 0; i < moves.length; i += 2) out.push({ number: i / 2 + 1, white: moves[i], black: moves[i + 1] })
    return out
  }, [moves])

  useEffect(() => {
    revealInside(endRef.current, { block: 'end' })
  }, [moves.length])

  const lastIndex = moves.length - 1

  return (
    <div className="relative h-full max-h-80 overflow-y-auto p-3 lg:max-h-none">
      {moves.length === 0 ? (
        <p className="grid h-full place-items-center py-10 text-center font-mono text-xs uppercase tracking-widest text-slate-600">
          Awaiting first move
        </p>
      ) : (
        <ol className="space-y-0.5 font-mono text-sm">
          {rows.map((row) => (
            <li
              key={row.number}
              className="grid grid-cols-[2.5rem_1fr_1fr] items-center rounded-lg px-2 py-1 transition-colors duration-300 odd:bg-slate-800/20"
            >
              <span className="text-slate-600">{row.number}.</span>
              <Ply san={row.white} latest={lastIndex === (row.number - 1) * 2} />
              <Ply san={row.black} latest={lastIndex === (row.number - 1) * 2 + 1} />
            </li>
          ))}
        </ol>
      )}
      <div ref={endRef} aria-hidden="true" className="h-px" />
    </div>
  )
})

function Ply({ san, latest }) {
  if (!san) return <span />
  return (
    <span
      className={cn(
        'w-fit animate-pop rounded-md px-2 py-0.5 transition-colors duration-300',
        latest ? 'bg-emerald-500/15 font-semibold text-emerald-300' : 'text-slate-300',
      )}
    >
      {san}
    </span>
  )
}
