import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, Eyebrow } from '../components/ui/Card'
import { ArrowRightIcon, BoltIcon, ChartIcon, CpuIcon, UsersIcon } from '../components/ui/Icons'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { useMatchmaking } from '../hooks/useMatchmaking'
import { BOT_DIFFICULTIES } from '../lib/config'
import { cn } from '../lib/cn'
import { lastGame } from '../lib/storage'

const bot = BOT_DIFFICULTIES.magnus

/** Ticks on its own so the rest of the lobby never re-renders per second. */
function QueueTimer() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return <span className="font-mono text-3xl font-semibold tabular-nums text-slate-100">{mm}:{ss}</span>
}

function Searching({ onCancel }) {
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-6 text-center animate-fade">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500/30" />
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500/20 [animation-delay:0.6s]" />
        <span className="relative grid size-14 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-glow-emerald">
          <UsersIcon className="size-6" />
        </span>
      </div>
      <div className="space-y-2">
        <Eyebrow className="text-emerald-300/80">Searching for an opponent</Eyebrow>
        <QueueTimer />
      </div>
      <Button variant="secondary" size="sm" onClick={onCancel}>
        Cancel search
      </Button>
    </div>
  )
}

function ModeCard({ className, accent, icon, eyebrow, title, description, children }) {
  return (
    <Card className={cn('relative flex flex-col overflow-hidden p-7 sm:p-8', className)}>
      <div
        aria-hidden="true"
        className={cn('pointer-events-none absolute -right-24 -top-24 size-72 rounded-full blur-3xl', accent)}
      />
      <div className="relative flex flex-1 flex-col">
        <span className="grid size-12 place-items-center rounded-2xl border border-slate-700/60 bg-slate-800/60 text-slate-200">
          {icon}
        </span>
        <Eyebrow className="mt-6">{eyebrow}</Eyebrow>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-50">{title}</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">{description}</p>
        <div className="mt-auto pt-8">{children}</div>
      </div>
    </Card>
  )
}

function InfoTile({ icon, label, value, to }) {
  const content = (
    <Card
      interactive={Boolean(to)}
      className="flex items-center gap-4 p-5"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-800/70 text-violet-300">{icon}</span>
      <span className="min-w-0 flex-1">
        <Eyebrow className="text-[10px]">{label}</Eyebrow>
        <span className="mt-1 block truncate font-mono text-sm text-slate-200">{value}</span>
      </span>
      {to && <ArrowRightIcon className="size-4 text-slate-500" />}
    </Card>
  )
  return to ? (
    <Link to={to} className="block">
      {content}
    </Link>
  ) : (
    content
  )
}

export default function LobbyPage() {
  const { user } = useAuth()
  const { phase, error, status, findMatch, startBotMatch, cancel } = useMatchmaking()
  const previous = lastGame.get()
  const busy = phase !== 'idle'
  const linkReady = status === 'connected'

  return (
    <div className="space-y-8 animate-rise">
      <header className="space-y-2">
        <Eyebrow>Command center</Eyebrow>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-50 sm:text-4xl">
          Choose your battleground,{' '}
          <span className="bg-linear-to-r from-violet-300 to-emerald-300 bg-clip-text text-transparent">
            {user?.username}
          </span>
        </h1>
        <p className="max-w-2xl text-slate-400">
          Face a human rival in real time, or test yourself against a Grandmaster-grade engine. Every match ends with a
          full tactical breakdown.
        </p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      <section className="grid gap-5 lg:grid-cols-12" aria-label="Game modes">
        <ModeCard
          className="lg:col-span-7"
          accent="bg-emerald-500/10"
          icon={<UsersIcon className="size-6" />}
          eyebrow="Player vs Player"
          title="Instant PvP"
          description="Enter the matchmaking queue and get paired with a live opponent. Colors are assigned by the server the moment a rival is found."
        >
          {phase === 'pvp' ? (
            <Searching onCancel={cancel} />
          ) : (
            <Button size="lg" onClick={findMatch} disabled={busy || !linkReady} className="w-full sm:w-auto">
              Find an opponent
              <ArrowRightIcon className="size-4" />
            </Button>
          )}
        </ModeCard>

        <ModeCard
          className="lg:col-span-5"
          accent="bg-violet-500/15"
          icon={<CpuIcon className="size-6" />}
          eyebrow="Player vs Engine"
          title={bot.label}
          description={`${bot.blurb} Rated ${bot.rating} — expect no mercy.`}
        >
          <Button
            variant="violet"
            size="lg"
            loading={phase === 'bot'}
            onClick={() => startBotMatch(bot.id)}
            disabled={busy || !linkReady}
            className="w-full sm:w-auto"
          >
            {phase === 'bot' ? 'Summoning the engine' : 'Challenge the engine'}
            {phase !== 'bot' && <ArrowRightIcon className="size-4" />}
          </Button>
        </ModeCard>
      </section>

      {!linkReady && (
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-slate-500">
          <Spinner className="size-3.5" /> Establishing realtime link…
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Quick info">
        <InfoTile icon={<BoltIcon className="size-5" />} label="Sync" value="Socket.IO · live moves" />
        <InfoTile icon={<CpuIcon className="size-5" />} label="Engine" value="Stockfish analysis" />
        <InfoTile
          icon={<ChartIcon className="size-5" />}
          label="Post-game"
          value={previous ? 'Review your last game' : 'Play to unlock'}
          to={previous ? '/analysis' : undefined}
        />
      </section>
    </div>
  )
}
