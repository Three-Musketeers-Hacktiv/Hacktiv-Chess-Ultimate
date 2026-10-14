import { Link } from 'react-router-dom'
import { ChessBoardPanel } from '../components/chess/ChessBoardPanel'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Eyebrow } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { usePuzzle } from '../hooks/usePuzzle'
import { cn } from '../lib/cn'

const TIER_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }

export default function PuzzlePage() {
  const { difficulty, puzzle, fen, status, notice, flash, error, onPieceDrop, canDragPiece, retry } = usePuzzle()
  const orientation = puzzle?.solver === 'b' ? 'black' : 'white'

  return (
    <div className="relative w-full min-w-0 space-y-6 animate-rise">
      {flash && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-30 bg-red-500/25 animate-fade"
        />
      )}

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Eyebrow className="text-amber-300/80">Unlimited tactics</Eyebrow>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-50 sm:text-3xl">Tactical Puzzles</h1>
          <p className="max-w-xl text-sm text-slate-400">
            Find the line. A correct finish climbs the ladder. A miss shuffles you back to a new easy puzzle.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
            {TIER_LABEL[difficulty] ?? difficulty}
          </span>
          <Link to="/lobby">
            <Button variant="secondary" size="sm">
              Lobby
            </Button>
          </Link>
        </div>
      </header>

      {error && (
        <div className="space-y-3">
          <Alert tone="error">{error}</Alert>
          <Button variant="secondary" size="sm" onClick={retry}>
            Try again
          </Button>
        </div>
      )}

      {status === 'success' && <Alert tone="success">Tactical Vision Perfect!</Alert>}
      {notice && status !== 'success' && <Alert tone="error">{notice}</Alert>}

      <section className="mx-auto w-full max-w-xl space-y-4" aria-label="Puzzle board">
        {status === 'loading' && !fen ? (
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-slate-500">
            <Spinner className="size-3.5" /> Loading puzzle…
          </p>
        ) : (
          fen && (
            <ChessBoardPanel
              fen={fen}
              orientation={orientation}
              interactive={status === 'solving'}
              onPieceDrop={onPieceDrop}
              canDragPiece={canDragPiece}
            />
          )
        )}
        {puzzle?.description && (
          <p className={cn('text-sm leading-relaxed text-slate-300', status === 'loading' && 'opacity-60')}>
            {puzzle.description}
          </p>
        )}
      </section>
    </div>
  )
}
