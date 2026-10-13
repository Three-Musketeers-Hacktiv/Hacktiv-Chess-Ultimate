import { evalToPercent, formatEval } from '../../lib/analysis'

/** Mono evaluation readout with a hairline white/black advantage bar. */
export function EvalMeter({ value }) {
  const whitePercent = evalToPercent(value)
  return (
    <div className="flex w-20 flex-col items-end gap-1.5">
      <span className="font-mono text-sm font-semibold tabular-nums text-slate-100">{formatEval(value)}</span>
      <span className="relative h-1 w-full overflow-hidden rounded-full bg-slate-950 ring-1 ring-slate-700/60" aria-hidden="true">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-slate-200 transition-all duration-500 ease-out"
          style={{ width: `${whitePercent}%` }}
        />
      </span>
    </div>
  )
}
