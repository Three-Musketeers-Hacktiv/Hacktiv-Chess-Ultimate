import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnalysisSummary } from '../components/analysis/AnalysisSummary'
import { MoveChip } from '../components/analysis/MoveChip'
import { ReviewBoard } from '../components/analysis/ReviewBoard'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, Eyebrow } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { useGameAnalysis } from '../hooks/useGameAnalysis'
import { buildReviewItems, summarize } from '../lib/analysis'
import { replayPgn, resolveVerdict } from '../lib/chess'
import { lastGame } from '../lib/storage'
import { cn } from '../lib/cn'

const VERDICT_STYLE = {
  win: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  loss: 'border-red-500/30 bg-red-500/10 text-red-300',
  draw: 'border-slate-600/40 bg-slate-700/20 text-slate-300',
}
const VERDICT_TEXT = { win: 'Victory', loss: 'Defeat', draw: 'Draw' }

function EmptyState() {
  return (
    <Card className="mx-auto mt-10 max-w-lg space-y-4 p-8 text-center animate-rise">
      <Eyebrow>Post-game analysis</Eyebrow>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-50">No finished game to review</h1>
      <p className="text-sm text-slate-400">
        Complete a match and your full tactical breakdown will appear here the moment the game ends.
      </p>
      <Link to="/lobby" className="inline-block">
        <Button>Go to lobby</Button>
      </Link>
    </Card>
  )
}

function LoadingList() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <p className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-violet-300">
        <Spinner className="size-4" /> Stockfish is evaluating every move…
      </p>
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="h-14 animate-sheen rounded-xl border border-slate-800/60 bg-slate-900/50"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  )
}

export default function AnalysisPage() {
  const { state } = useLocation()
  // `useState` initialiser: read storage once, not on every render.
  const [stored] = useState(() => lastGame.get())

  const pgn = state?.pgn || stored?.pgn || ''
  const meta = stored && (!pgn || stored.pgn === pgn || !state?.pgn) ? stored : null

  const { status, analysis, error, retry } = useGameAnalysis(pgn)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const plies = useMemo(() => replayPgn(pgn), [pgn])
  const items = useMemo(() => buildReviewItems(analysis, plies), [analysis, plies])
  const counts = useMemo(() => summarize(items), [items])

  const lastIndex = items.length - 1
  const activeIndex = Math.min(selectedIndex, Math.max(lastIndex, 0))
  const activeItem = items[activeIndex] ?? null

  // ←/→ review shortcuts.
  useEffect(() => {
    if (!items.length) return undefined
    const onKey = (event) => {
      if (event.key === 'ArrowRight') setSelectedIndex((i) => Math.min(i + 1, items.length - 1))
      if (event.key === 'ArrowLeft') setSelectedIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length])

  if (!pgn) return <EmptyState />

  const verdict = meta?.outcome ? resolveVerdict(meta.outcome, meta.me) : null

  return (
    <div className="space-y-8 animate-rise">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Eyebrow>Post-game analysis</Eyebrow>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-50">
            {meta?.opponent?.username ? (
              <>
                You vs <span className="text-violet-300">{meta.opponent.username}</span>
              </>
            ) : (
              'Match review'
            )}
          </h1>
          {meta?.outcome?.message && <p className="text-sm text-slate-400">{meta.outcome.message}</p>}
        </div>
        <div className="flex items-center gap-3">
          {verdict && (
            <span
              className={cn(
                'rounded-full border px-3.5 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest',
                VERDICT_STYLE[verdict],
              )}
            >
              {VERDICT_TEXT[verdict]}
            </span>
          )}
          <Link to="/lobby">
            <Button variant="secondary" size="sm">
              New game
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
        <section className="mx-auto w-full max-w-[min(100%,calc(100dvh-16rem))]" aria-label="Position review">
          <ReviewBoard
            item={activeItem}
            color={meta?.color ?? 'w'}
            index={activeIndex}
            total={items.length}
            onPrev={() => setSelectedIndex((i) => Math.max(Math.min(i, lastIndex) - 1, 0))}
            onNext={() => setSelectedIndex((i) => Math.min(i + 1, lastIndex))}
          />
        </section>

        <section className="min-w-0 space-y-5" aria-label="Move classifications">
          {status === 'loading' && <LoadingList />}

          {status === 'error' && (
            <div className="space-y-3">
              <Alert tone="error">{error}</Alert>
              <Button variant="secondary" size="sm" onClick={retry}>
                Retry analysis
              </Button>
            </div>
          )}

          {status === 'success' && (
            <>
              {items.length > 0 ? (
                <>
                  <AnalysisSummary counts={counts} total={items.length} />
                  <ol className="relative -mr-2 max-h-[calc(100dvh-26rem)] min-h-72 space-y-2 overflow-y-auto pr-2">
                    {items.map((item, index) => (
                      <MoveChip
                        key={item.key}
                        item={item}
                        index={index}
                        active={index === activeIndex}
                        onSelect={setSelectedIndex}
                      />
                    ))}
                  </ol>
                </>
              ) : (
                <Alert tone="info">The engine returned no evaluated moves for this game.</Alert>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
