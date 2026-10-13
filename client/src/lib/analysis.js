import { resolveSan } from './chess'

/**
 * Visual language for each tactical classification.
 *  - Best Move → luxury emerald
 *  - Mistake   → amber (between the two poles)
 *  - Blunder   → crisp vermillion
 */
export const LABEL_TONES = Object.freeze({
  best: {
    key: 'best',
    text: 'Best Move',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
    ring: 'hover:border-emerald-500/40 data-[active=true]:border-emerald-500/50 data-[active=true]:shadow-glow-emerald',
    arrow: '#10B981',
  },
  mistake: {
    key: 'mistake',
    text: 'Mistake',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
    ring: 'hover:border-amber-500/40 data-[active=true]:border-amber-500/50',
    arrow: '#F59E0B',
  },
  blunder: {
    key: 'blunder',
    text: 'Blunder',
    chip: 'border-red-500/30 bg-red-500/10 text-red-300',
    dot: 'bg-vermillion',
    ring: 'hover:border-red-500/40 data-[active=true]:border-red-500/50 data-[active=true]:shadow-glow-crimson',
    arrow: '#EF4444',
  },
  neutral: {
    key: 'neutral',
    text: 'Move',
    chip: 'border-slate-600/40 bg-slate-700/20 text-slate-300',
    dot: 'bg-slate-400',
    ring: 'hover:border-slate-600/60 data-[active=true]:border-violet-500/40 data-[active=true]:shadow-glow',
    arrow: '#94A3B8',
  },
})

export function toneFor(label) {
  const normalized = String(label ?? '').trim().toLowerCase()
  if (normalized.includes('best') || normalized.includes('excellent') || normalized.includes('good')) return LABEL_TONES.best
  if (normalized.includes('blunder')) return LABEL_TONES.blunder
  if (normalized.includes('mistake') || normalized.includes('inaccuracy')) return LABEL_TONES.mistake
  return { ...LABEL_TONES.neutral, text: label || LABEL_TONES.neutral.text }
}

/**
 * Numeric value of an evaluation string (`"+0.3"`, `"-1.5"`, `"#3"`, `"M-2"`).
 * Mates are clamped to ±99 so they still render on the bar.
 */
export function parseEval(raw) {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim()
  const mate = text.match(/^[#M]\s*([+-]?)(\d+)$/i)
  if (mate) return mate[1] === '-' ? -99 : 99
  const value = Number.parseFloat(text)
  return Number.isFinite(value) ? value : null
}

/** Always show an explicit sign for evaluations (`0.3` → `+0.3`). */
export function formatEval(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return '—'
  const value = parseEval(text)
  if (value === null) return text
  if (/^[#M]/i.test(text)) return text.toUpperCase()
  return value > 0 && !text.startsWith('+') ? `+${text}` : text
}

/** Position of the white/black divider (0–100% white) for an eval. */
export function evalToPercent(raw) {
  const value = parseEval(raw)
  if (value === null) return 50
  return 50 + 50 * Math.tanh(value / 3)
}

/**
 * Maps the server's flat analysis list onto concrete plies of the replayed game.
 * The contract's `move_number` is the *full* move number, so we match on
 * (move number + SAN) first, then fall back to SAN only, then to the raw index.
 */
export function buildReviewItems(analysis, plies) {
  const used = new Set()

  return (analysis ?? []).map((entry, index) => {
    const san = entry.move
    const fullMove = Number(entry.move_number)

    let ply = plies.find((p) => !used.has(p.ply) && p.san === san && Math.ceil(p.ply / 2) === fullMove)
    ply ??= plies.find((p) => !used.has(p.ply) && p.san === san)
    ply ??= plies[index]
    if (ply) used.add(ply.ply)

    const alternative = entry.best_alternative && ply ? resolveSan(ply.fenBefore, entry.best_alternative) : null

    return {
      key: `${entry.move_number}-${san}-${index}`,
      moveNumber: fullMove,
      san,
      color: ply?.color ?? null,
      evaluation: entry.evaluation,
      label: entry.label,
      tone: toneFor(entry.label),
      bestAlternative: entry.best_alternative ?? null,
      alternativeMove: alternative,
      fenBefore: ply?.fenBefore ?? null,
      playedMove: ply ? { from: ply.from, to: ply.to } : null,
    }
  })
}

export function summarize(items) {
  return items.reduce(
    (acc, item) => {
      acc[item.tone.key] = (acc[item.tone.key] ?? 0) + 1
      return acc
    },
    { best: 0, mistake: 0, blunder: 0 },
  )
}
