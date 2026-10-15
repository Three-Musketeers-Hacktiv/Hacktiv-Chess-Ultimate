import { resolveSan } from './chess'

/**
 * Visual language for each tactical classification.
 *  - Best Move → luxury emerald
 *  - Mistake   → amber (between the two poles)
 *  - Blunder   → crisp vermillion
 * `badge` is the Chess.com-style marker drawn on the destination square of the move under review;
 * `group` is the bucket of the summary counters (Brilliant/Good count as "best moves").
 * The server only labels `Best Move | Mistake | Blunder`; "Good" is a Best Move that is not the engine's
 * first choice (the server still names a `best_alternative`), "Brilliant" is used if a server ever sends it.
 */
export const LABEL_TONES = Object.freeze({
  brilliant: {
    key: 'brilliant',
    group: 'best',
    text: 'Brilliant',
    chip: 'border-cyan-800/40 bg-cyan-950/30 text-cyan-400',
    panel: 'border-cyan-800/40 bg-cyan-950/20',
    dot: 'bg-cyan-400',
    ring: 'hover:border-cyan-500/40 data-[active=true]:border-cyan-500/50',
    arrow: '#06B6D4',
    badge: { icon: '★', className: 'bg-[#00e6e6] text-slate-900!' },
  },
  good: {
    key: 'good',
    group: 'best',
    text: 'Good Move',
    chip: 'border-blue-800/40 bg-blue-950/30 text-blue-400',
    panel: 'border-blue-800/40 bg-blue-950/20',
    dot: 'bg-blue-400',
    ring: 'hover:border-blue-500/40 data-[active=true]:border-blue-500/50',
    arrow: '#3B82F6',
    badge: { icon: '✓', className: 'bg-[#5c8a8a]' },
  },
  book: {
    key: 'book',
    group: 'neutral',
    text: 'Book Move',
    chip: 'border-amber-900/50 bg-amber-950/30 text-amber-600',
    panel: 'border-amber-900/50 bg-amber-950/20',
    dot: 'bg-[#a3704c]',
    ring: 'hover:border-amber-700/40 data-[active=true]:border-amber-700/50',
    arrow: '#A3704C',
    badge: { icon: '📖', className: 'bg-[#a3704c]' },
  },
  best: {
    key: 'best',
    group: 'best',
    text: 'Best Move',
    badge: { icon: '✓', className: 'bg-[#81b64c]' },
    chip: 'border-emerald-800/40 bg-emerald-950/30 text-emerald-400',
    panel: 'border-emerald-800/40 bg-emerald-950/20',
    dot: 'bg-emerald-400',
    ring: 'hover:border-emerald-500/40 data-[active=true]:border-emerald-500/50 data-[active=true]:shadow-glow-emerald',
    arrow: '#10B981',
  },
  mistake: {
    key: 'mistake',
    group: 'mistake',
    text: 'Mistake',
    // A bold dark "?" rather than the ❓ emoji: a red glyph would vanish on the amber disc.
    badge: { icon: '?!', className: 'bg-[#f7c04a] text-slate-900!' },
    chip: 'border-amber-800/40 bg-amber-950/30 text-amber-400',
    panel: 'border-amber-800/40 bg-amber-950/20',
    dot: 'bg-amber-400',
    ring: 'hover:border-amber-500/40 data-[active=true]:border-amber-500/50',
    arrow: '#F59E0B',
  },
  blunder: {
    key: 'blunder',
    group: 'blunder',
    text: 'Blunder',
    // A white "✕" rather than the ❌ emoji, for the same contrast reason.
    badge: { icon: '×', className: 'bg-[#fa4646]' },
    chip: 'border-red-800/40 bg-red-950/30 text-red-400',
    panel: 'border-red-800/40 bg-red-950/20',
    dot: 'bg-vermillion',
    ring: 'hover:border-red-500/40 data-[active=true]:border-red-500/50 data-[active=true]:shadow-glow-crimson',
    arrow: '#EF4444',
  },
  neutral: {
    key: 'neutral',
    group: 'neutral',
    text: 'Move',
    badge: null,
    chip: 'border-slate-600/40 bg-slate-700/20 text-slate-300',
    panel: 'border-slate-700/40 bg-slate-800/30',
    dot: 'bg-slate-400',
    ring: 'hover:border-slate-600/60 data-[active=true]:border-violet-500/40 data-[active=true]:shadow-glow',
    arrow: '#94A3B8',
  },
})

/** `bestAlternative`: the engine's preferred move when it differs from the one played (turns "Best" into "Good"). */
export function toneFor(label, bestAlternative = null) {
  const normalized = String(label ?? '').trim().toLowerCase()
  if (normalized.includes('brilliant')) return LABEL_TONES.brilliant
  if (normalized.includes('book')) return LABEL_TONES.book
  if (normalized.includes('good') || (normalized.includes('best') && bestAlternative)) return LABEL_TONES.good
  if (normalized.includes('best') || normalized.includes('excellent')) return LABEL_TONES.best
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
 * The server scores a position as `{ cp, mate }` from White's point of view (`cp` in centipawns, `mate`
 * in moves, the other one `null`). `EvalMeter` reads pawn-unit strings: `"+0.3"`, `"-1.5"`, `"#3"`, `"#-2"`.
 * Strings/numbers pass through so older payload shapes keep working.
 */
export function formatScore(score) {
  if (score === null || score === undefined) return null
  if (typeof score !== 'object') return score
  if (Number.isInteger(score.mate)) return `#${score.mate}`
  if (Number.isFinite(score.cp)) {
    const pawns = (score.cp / 100).toFixed(1)
    return score.cp > 0 ? `+${pawns}` : pawns
  }
  return null
}

/**
 * Maps the server's analysis list (`POST /api/games/:id/analysis`) onto the replayed game. Every entry
 * carries its half-move number (`ply`), so the match is exact; SAN and list position are only fallbacks.
 */
export function buildReviewItems(analysis, plies) {
  return (analysis ?? []).map((entry, index) => {
    const san = entry.move
    const entryPly = Number(entry.ply)

    let ply = plies.find((p) => p.ply === entryPly)
    ply ??= plies[index]

    const alternative = entry.best_alternative && ply ? resolveSan(ply.fenBefore, entry.best_alternative) : null
    const number = Number.isFinite(entryPly) ? entryPly : index + 1

    return {
      key: `${number}-${san}`,
      moveNumber: Math.ceil(number / 2),
      san,
      color: entry.color ?? ply?.color ?? null,
      evaluation: formatScore(entry.evaluation),
      label: entry.label,
      tone: toneFor(entry.label, entry.best_alternative),
      bestAlternative: entry.best_alternative ?? null,
      centipawnLoss: Number.isFinite(entry.centipawn_loss) ? entry.centipawn_loss : null,
      alternativeMove: alternative,
      fenBefore: ply?.fenBefore ?? null,
      fenAfter: ply?.fenAfter ?? null,
      playedMove: ply ? { from: ply.from, to: ply.to } : null,
    }
  })
}

/** Plain replay rows (no engine labels) — used while Stockfish analysis is not available on the server. */
export function buildReplayItems(plies) {
  return plies.map((ply) => ({
    key: `ply-${ply.ply}`,
    moveNumber: Math.ceil(ply.ply / 2),
    san: ply.san,
    color: ply.color,
    evaluation: null,
    label: null,
    tone: LABEL_TONES.neutral,
    bestAlternative: null,
    centipawnLoss: null,
    alternativeMove: null,
    fenBefore: ply.fenBefore,
    fenAfter: ply.fenAfter,
    playedMove: { from: ply.from, to: ply.to },
  }))
}

export function summarize(items) {
  return items.reduce(
    (acc, item) => {
      const bucket = item.tone.group ?? item.tone.key
      acc[bucket] = (acc[bucket] ?? 0) + 1
      return acc
    },
    { best: 0, mistake: 0, blunder: 0 },
  )
}
