import { cn } from '../../lib/cn'
import { Card } from '../ui/Card'

function Stat({ label, value, tone }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className={cn('mt-1.5 font-mono text-3xl font-semibold tabular-nums', tone)}>{value}</p>
    </Card>
  )
}

export function AnalysisSummary({ counts, total }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat label="Best moves" value={counts.best} tone="text-emerald-300" />
      <Stat label="Mistakes" value={counts.mistake} tone="text-amber-300" />
      <Stat label="Blunders" value={counts.blunder} tone="text-red-300" />
      <p className="col-span-3 -mt-1 font-mono text-[11px] uppercase tracking-widest text-slate-600">
        {total} evaluated moves
      </p>
    </div>
  )
}
