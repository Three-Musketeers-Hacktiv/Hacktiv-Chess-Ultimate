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
import { buildReplayItems, buildReviewItems, summarize } from '../lib/analysis'
import { describeOutcome, replayPgn, resolveVerdict } from '../lib/chess'
import { MAX_ANALYZED_PLIES } from '../lib/config'
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
  // Only a fallback for the (unusual) case without a PGN: the server then analyses the stored game by id.
  const gameId = state?.gameId || (meta?.pgn === pgn ? meta?.gameId : null) || null

  const plies = useMemo(() => replayPgn(pgn), [pgn])
  const tooLong = plies.length > MAX_ANALYZED_PLIES
  // The request fires on mount: the PGN of the finished game goes to `POST /api/game/analyze`.
  const { status, analysis, error, retry } = useGameAnalysis({ pgn, gameId }, !tooLong)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // No engine pass possible (game too long, engine offline) → plain replay, with a notice that says why.
  const replayOnly = status === 'unavailable' || status === 'idle'
  const items = useMemo(
    () => (replayOnly ? buildReplayItems(plies) : buildReviewItems(analysis, plies)),
    [replayOnly, analysis, plies],
  )
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
    <div className="flex min-h-screen w-full flex-col space-y-8 overflow-y-auto bg-slate-950 pb-8 text-slate-100 animate-rise">
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
          {meta?.outcome && <p className="text-sm text-slate-400">{describeOutcome(meta.outcome).message}</p>}
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

        <section className="h-auto min-w-0 w-full space-y-5" aria-label="Move classifications">
          {status === 'loading' && <LoadingList />}

          {status === 'error' && (
            <div className="space-y-3">
              <Alert tone="error">{error}</Alert>
              <Button variant="secondary" size="sm" onClick={retry}>
                Retry analysis
              </Button>
            </div>
          )}

          {replayOnly && (
            <div className="animate-pop rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-4 shadow-glow">
              {tooLong ? (
                <>
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-violet-200">
                    Analysis limit · {MAX_ANALYZED_PLIES} half-moves
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    The engine reviews games of up to {MAX_ANALYZED_PLIES} half-moves; this one has {plies.length}. You
                    can still replay it move by move.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-mono text-xs font-semibold uppercase tracking-widest text-violet-200">
                    Stockfish analysis · Engine offline
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    The server could not start Stockfish (check <span className="font-mono">STOCKFISH_PATH</span>). You
                    can still replay the game move by move below.
                  </p>
                </>
              )}
            </div>
          )}

          {(status === 'success' || replayOnly) && (
            <>
              {items.length > 0 ? (
                <>
                  {!replayOnly && <AnalysisSummary counts={counts} total={items.length} />}
                  <div className="w-full max-h-[300px] overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch] sm:max-h-[400px]">
                    <ol className="space-y-2">
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
                  </div>
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
