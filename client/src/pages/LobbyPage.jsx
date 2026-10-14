import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Card, Eyebrow } from '../components/ui/Card'
import { ArrowRightIcon, ChartIcon, CpuIcon, SearchIcon, UsersIcon } from '../components/ui/Icons'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { useHome } from '../hooks/useHome'
import { useLiveGames } from '../hooks/useLiveGames'
import { useMatchmaking } from '../hooks/useMatchmaking'
import { useSocket } from '../hooks/useSocket'
import { BOT, TIME_CONTROLS, timeControlLabel } from '../lib/config'
import { cn } from '../lib/cn'
import { lastGame } from '../lib/storage'

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

function Searching({ timeControl, stage, connected, onCancel }) {
  return (
    <div className="flex min-h-72 animate-fade flex-col items-center justify-center gap-6 text-center">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500/30" />
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500/20 [animation-delay:0.6s]" />
        <span className="relative grid size-14 animate-pulse place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-glow-emerald">
          <SearchIcon className="size-6" />
        </span>
      </div>
      <div className="space-y-2">
        <Eyebrow className="text-emerald-300/80">Mencari lawan · {timeControlLabel(timeControl)}</Eyebrow>
        <QueueTimer />
        <p className="font-mono text-xs text-slate-500">
          {!connected
            ? 'Reconnecting to the realtime link…'
            : stage === 'waiting'
              ? 'In the queue — the game starts the moment a rival with the same time control joins.'
              : 'Joining the matchmaking queue…'}
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={onCancel}>
        Cancel Search
      </Button>
    </div>
  )
}

function ComingSoonBadge({ children = 'Coming Soon' }) {
  return (
    <span className="rounded-md border border-slate-700/60 bg-slate-800/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
      {children}
    </span>
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
        <div className="mt-6 flex-1">{children}</div>
      </div>
    </Card>
  )
}

function TimeControlPicker({ value, onChange, disabled, unsupported }) {
  return (
    <div role="radiogroup" aria-label="Time control" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TIME_CONTROLS.map((tc) => {
        const active = tc.id === value
        const soon = unsupported.includes(tc.id)
        return (
          <button
            key={tc.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || soon}
            onClick={() => onChange(tc.id)}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition-all duration-300 ease-out hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50',
              soon && 'disabled:pointer-events-none disabled:opacity-40',
              active
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200 shadow-glow-emerald'
                : 'border-slate-800/60 bg-slate-950/40 text-slate-300 hover:border-slate-700',
            )}
          >
            <span className="block text-sm font-semibold">{tc.label}</span>
            <span className="block font-mono text-xs text-slate-500">{tc.detail}</span>
            {soon && (
              <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-slate-500/80">
                Coming Soon
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

const ROW =
  'flex items-center gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 transition-all duration-300 ease-out hover:border-slate-700'
const LINK_BTN =
  'rounded-lg border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-200 transition-all duration-300 ease-out hover:scale-[1.01] hover:border-slate-600 active:scale-[0.99]'

function YouTag() {
  return (
    <span className="ml-2 rounded-md border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet-300">
      You
    </span>
  )
}

function LiveRow({ game, mine }) {
  return (
    <li className={ROW}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-100">
          {game.white} <span className="font-normal text-slate-500">vs</span> {game.black}
          {mine && <YouTag />}
        </p>
        <p className="font-mono text-xs text-slate-500">
          {timeControlLabel(game.time_control?.id)} · {game.moveCount ?? 0} moves
        </p>
      </div>
      <Link to={`/arena/${game.id}`} className={LINK_BTN}>
        {mine ? 'Rejoin' : 'Watch'}
      </Link>
    </li>
  )
}

function Empty({ children }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-800/80 px-4 py-6 text-center text-sm text-slate-500">
      {children}
    </p>
  )
}

function StatTile({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 px-4 py-3 backdrop-blur-xl">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={cn('mt-1 font-mono text-2xl font-semibold tabular-nums', tone)}>{value ?? '—'}</p>
    </div>
  )
}

function FeatureTile({ icon, label, status, to }) {
  const soon = status !== 'available'
  const content = (
    <Card interactive={Boolean(to)} className="flex items-center gap-4 p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-800/70 text-violet-300">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-200">{label}</span>
        <span className="mt-1 block">{soon ? <ComingSoonBadge /> : <span className="font-mono text-xs text-emerald-300">Available</span>}</span>
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

const FEATURE_ICONS = { analysis: ChartIcon }

export default function LobbyPage() {
  const { user } = useAuth()
  const { socket, status } = useSocket()
  const { stats, features, capabilities } = useHome()
  const connected = status === 'connected'
  const mm = useMatchmaking({ socket })
  const { unsupported } = mm
  const searching = mm.phase === 'searching'
  const live = useLiveGames(!searching)
  const [selectedTime, setSelectedTime] = useState('blitz')
  // Never keep an option selected once the server has shown it ignores that time control.
  const timeControl = unsupported.includes(selectedTime)
    ? (TIME_CONTROLS.find((tc) => !unsupported.includes(tc.id))?.id ?? selectedTime)
    : selectedTime
  const previous = lastGame.get()
  const busy = searching
  const error = mm.error
  const me = user?.username?.toLowerCase()

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
          Pick a time control and get matched with a rival instantly. Every clock is kept by the server.
        </p>
      </header>

      {stats && (
        <section className="grid max-w-md grid-cols-3 gap-3" aria-label="Your record">
          <StatTile label="Wins" value={stats.wins} tone="text-emerald-300" />
          <StatTile label="Draws" value={stats.draws} tone="text-slate-200" />
          <StatTile label="Losses" value={stats.losses} tone="text-red-300" />
        </section>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      <section className="grid gap-5 lg:grid-cols-12" aria-label="Game modes">
        <ModeCard
          className="lg:col-span-7"
          accent="bg-emerald-500/10"
          icon={<UsersIcon className="size-6" />}
          eyebrow="Player vs Player"
          title="Instant PvP"
          description="Choose how fast you want to play and hit “Cari Lawan” — you are paired with the next rival who picked the same time control."
        >
          {searching ? (
            <Searching timeControl={mm.searchingFor} stage={mm.stage} connected={connected} onCancel={mm.cancel} />
          ) : (
            <div className="space-y-5">
              <TimeControlPicker
                value={timeControl}
                onChange={setSelectedTime}
                disabled={busy}
                unsupported={unsupported}
              />
              <Button
                size="lg"
                disabled={busy || !connected}
                onClick={() => mm.start(timeControl)}
                className="w-full sm:w-auto"
              >
                <SearchIcon className="size-4" />
                Cari Lawan
                <ArrowRightIcon className="size-4" />
              </Button>

            </div>
          )}
        </ModeCard>

        <ModeCard
          className="lg:col-span-5"
          accent="bg-violet-500/15"
          icon={<CpuIcon className="size-6" />}
          eyebrow="Player vs Engine"
          title={BOT.label}
          description={`${BOT.blurb} Rated ${BOT.rating} — expect no mercy.`}
        >
          <Button variant="violet" size="lg" disabled className="w-full sm:w-auto">
            Coming Soon
          </Button>
          <p className="mt-3 font-mono text-xs text-slate-500">
            {capabilities.bot
              ? 'The server reports bot mode as available — client support is pending.'
              : 'Feature under development by the Backend Team.'}
          </p>
        </ModeCard>
      </section>

      {/* Only when something is running: lets you rejoin your own game or watch another one. */}
      {live.games.length > 0 && (
        <section className="space-y-3 animate-fade" aria-label="Games in progress">
          <Eyebrow>Games in progress</Eyebrow>
          <ul className="grid gap-2 md:grid-cols-2">
            {live.games.map((game) => (
              <LiveRow
                key={game.id}
                game={game}
                mine={game.white?.toLowerCase() === me || game.black?.toLowerCase() === me}
              />
            ))}
          </ul>
        </section>
      )}

      {!connected && (
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-slate-500">
          <Spinner className="size-3.5" /> Establishing realtime link…
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Features">
        <FeatureTile
          icon={<ChartIcon className="size-5" />}
          label={previous ? 'Review your last game' : 'Post-game review'}
          status="available"
          to={previous ? '/analysis' : undefined}
        />
        {features.map((feature) => {
          const Icon = FEATURE_ICONS[feature.id] ?? CpuIcon
          return (
            <FeatureTile
              key={feature.id}
              icon={<Icon className="size-5" />}
              label={feature.label}
              status={feature.status}
            />
          )
        })}
      </section>
    </div>
  )
}
