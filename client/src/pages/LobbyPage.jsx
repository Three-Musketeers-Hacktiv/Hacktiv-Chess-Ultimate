import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../components/ui/Alert'
import { Button } from '../components/ui/Button'
import { Eyebrow } from '../components/ui/Card'
import { CpuIcon, SearchIcon, UsersIcon } from '../components/ui/Icons'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../hooks/useAuth'
import { useBotGame } from '../hooks/useBotGame'
import { useHome } from '../hooks/useHome'
import { useLiveGames } from '../hooks/useLiveGames'
import { useMatchmaking } from '../hooks/useMatchmaking'
import { useSocket } from '../hooks/useSocket'
import { BOT, BOT_DIFFICULTIES, TIME_CONTROLS, timeControlLabel } from '../lib/config'
import { cn } from '../lib/cn'

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

function Searching({ timeControl, stage, connected, ranked, onCancel }) {
  return (
    <div className="flex min-h-72 animate-fade flex-col items-center justify-center gap-6 text-center">
      <div className="relative grid size-20 place-items-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500/30" />
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-emerald-500/20 [animation-delay:0.6s]" />
        <span className="relative grid size-14 place-items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
          <SearchIcon className="size-6" />
        </span>
      </div>
      <div className="space-y-2">
        <Eyebrow className="text-emerald-300/80">
          {ranked ? 'Mencari lawan ranked' : 'Mencari lawan'} · {timeControlLabel(timeControl)}
        </Eyebrow>
        <QueueTimer />
        <p className="font-mono text-xs text-slate-500">
          {!connected
            ? 'Reconnecting to the realtime link…'
            : stage === 'waiting'
              ? ranked
                ? 'In the ranked queue — the game starts when a rival within ±200 ELO and the same time control joins.'
                : 'In the queue — the game starts the moment a rival with the same time control joins.'
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

const GLASS =
  'flex h-full w-full min-w-0 flex-col rounded-2xl border border-slate-800/40 bg-[#0F1524]/60 p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] backdrop-blur-xl transition-all duration-300 hover:border-slate-700/60 hover:shadow-[0_8px_40px_0_rgba(0,0,0,0.6)]'

const PILL_BASE =
  'flex flex-col items-center justify-center rounded-xl border px-3 py-2 text-xs tracking-wide transition-all duration-200 disabled:opacity-40'

const PILL_OFF =
  'border-slate-900/40 bg-slate-950/40 font-medium text-slate-400 hover:border-slate-800/80 hover:text-slate-200'

const PILL_TIME_ON =
  'border-emerald-500/30 bg-emerald-500/10 font-semibold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.1)]'

const PILL_DIFF_ON =
  'border-blue-500/30 bg-blue-500/10 font-semibold text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.1)]'

const ACTION_BASE =
  'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold tracking-wide transition-all duration-300 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-40'

const ACTION = cn(
  ACTION_BASE,
  'border border-emerald-500/30 bg-linear-to-r from-emerald-500/10 to-teal-500/10 text-emerald-400 hover:border-emerald-500/50 hover:from-emerald-500/20 hover:to-teal-500/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
)

const ACTION_BLUE = cn(
  ACTION_BASE,
  'border border-blue-500/30 bg-linear-to-r from-blue-500/10 to-indigo-500/10 text-blue-400 hover:border-blue-500/50 hover:from-blue-500/20 hover:to-indigo-500/20 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
)

const ACTION_AMBER = cn(
  ACTION_BASE,
  'border border-amber-500/30 bg-linear-to-r from-amber-500/10 to-orange-500/10 text-amber-400 hover:border-amber-500/50 hover:from-amber-500/20 hover:to-orange-500/20 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
)

function Kicker({ children, dot }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
      <span aria-hidden="true" className={cn('size-1 rounded-full', dot)} />
      {children}
    </p>
  )
}

function ModeCard({ className, icon, eyebrow, title, description, dot, children }) {
  return (
    <section className={cn(GLASS, className)}>
      <Kicker dot={dot}>
        {icon}
        {eyebrow}
      </Kicker>
      <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-xs font-normal leading-relaxed text-slate-400">{description}</p>
      <div className="mt-5 flex flex-1 flex-col">{children}</div>
    </section>
  )
}

function TimeControlPicker({ value, onChange, disabled, unsupported }) {
  return (
    <div role="radiogroup" aria-label="Time control" className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
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
            className={`${PILL_BASE} ${active ? PILL_TIME_ON : PILL_OFF}${soon ? ' pointer-events-none opacity-40' : ''}`}
          >
            <span className="block">{tc.label}</span>
            <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{tc.detail}</span>
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

function DifficultyPicker({ value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label="Stockfish difficulty" className="grid w-full grid-cols-3 gap-2">
      {BOT_DIFFICULTIES.map((level) => {
        const active = level.id === value
        return (
          <button
            key={level.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(level.id)}
            className={`${PILL_BASE} ${active ? PILL_DIFF_ON : PILL_OFF}`}
          >
            <span className="block">{level.label}</span>
            <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{level.detail}</span>
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

function EloBadge({ elo }) {
  return (
    <p aria-label={elo != null ? `Elo rating ${elo}` : 'Elo rating unavailable'}>
      Elo <span className="font-bold tabular-nums text-emerald-400">{elo ?? '—'}</span>
    </p>
  )
}

function RankedCard({ className, searching, ranked, children, searchingView }) {
  return (
    <section aria-label="Competitive ranked match" className={cn(GLASS, className)}>
      {searching && ranked ? (
        searchingView
      ) : (
        <>
          <Kicker dot="bg-emerald-400/80">Ranked · Elo K-32</Kicker>
          <h2 className="text-xl font-semibold tracking-tight text-white">Competitive Ranked Match</h2>
          <p className="mt-1 text-xs font-normal leading-relaxed text-slate-400">
            Rated game against a rival within ±200 ELO. Win and climb; lose and your rating pays for it — the exact
            change is shown the moment the game ends.
          </p>
          <div className="mt-5 flex-1">{children}</div>
        </>
      )}
    </section>
  )
}

function StatTile({ label, value, valueClass }) {
  return (
    <p>
      {label} <span className={cn('font-bold tabular-nums', valueClass)}>{value ?? '—'}</span>
    </p>
  )
}

export default function LobbyPage() {
  const { user } = useAuth()
  const { socket, status } = useSocket()
  const { stats, capabilities, elo, refresh, status: homeStatus } = useHome()
  const connected = status === 'connected'
  const mm = useMatchmaking({ socket })
  const { unsupported } = mm
  const searching = mm.phase === 'searching'
  const searchingRanked = searching && mm.searchingMode === 'ranked'

  // Ratings and stats move after every game: re-read them whenever the lobby opens.
  useEffect(() => {
    refresh()
  }, [refresh])
  const live = useLiveGames(!searching)
  const [pvpTime, setPvpTime] = useState('bullet')
  const [rankedTime, setRankedTime] = useState('blitz')
  const resolveTime = (selected) =>
    unsupported.includes(selected)
      ? (TIME_CONTROLS.find((tc) => !unsupported.includes(tc.id))?.id ?? selected)
      : selected
  const bot = useBotGame()
  const [difficulty, setDifficulty] = useState('medium')
  const busy = searching || bot.starting
  const error = mm.error || bot.error
  const me = user?.username?.toLowerCase()

  return (
    <div className="min-h-full w-full min-w-0 animate-rise bg-[#080C14]">
      <header className="min-w-0">
        <Eyebrow>Command center</Eyebrow>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-200 sm:text-2xl">
          Choose your battleground, {user?.username}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Pick a time control and get matched with a rival instantly — or take on Stockfish. Every clock is kept by the
          server.
        </p>
      </header>

      {(stats || elo != null) && (
        <section className="my-6 flex flex-wrap items-center gap-6 font-mono text-xs tracking-wider text-slate-400" aria-label="Your rating and record">
          <EloBadge elo={elo} />
          <StatTile label="Wins" value={stats?.wins} valueClass="text-blue-400" />
          <StatTile label="Draws" value={stats?.draws} valueClass="text-slate-300" />
          <StatTile label="Losses" value={stats?.losses} valueClass="text-amber-500/80" />
        </section>
      )}

      {error && (
        <div className="mt-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <section className="mt-8 grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Game modes">
        <ModeCard
          icon={<UsersIcon className="size-3" />}
          dot="bg-emerald-400/80"
          eyebrow="Player vs Player"
          title="Instant PvP"
          description="Choose how fast you want to play and hit “Cari Lawan” — you are paired with the next rival who picked the same time control."
        >
          {searching && !searchingRanked ? (
            <Searching timeControl={mm.searchingFor} stage={mm.stage} connected={connected} onCancel={mm.cancel} />
          ) : (
            <div className="space-y-5">
              <TimeControlPicker
                value={pvpTime}
                onChange={setPvpTime}
                disabled={busy}
                unsupported={unsupported}
              />
              <button
                type="button"
                disabled={busy || !connected}
                onClick={() => mm.start(resolveTime(pvpTime), 'casual')}
                className={ACTION}
              >
                Cari Lawan
              </button>

            </div>
          )}
        </ModeCard>

        <RankedCard
          searching={searching}
          ranked={searchingRanked}
          searchingView={
            <Searching ranked timeControl={mm.searchingFor} stage={mm.stage} connected={connected} onCancel={mm.cancel} />
          }
        >
          <div className="space-y-5">
            <TimeControlPicker value={rankedTime} onChange={setRankedTime} disabled={busy} unsupported={unsupported} />
            <button
              type="button"
              disabled={busy || !connected}
              onClick={() => mm.start(resolveTime(rankedTime), 'ranked')}
              className={ACTION}
            >
              Competitive Ranked Match
            </button>
          </div>
        </RankedCard>

        <ModeCard
          icon={<CpuIcon className="size-3" />}
          dot="bg-blue-400/80"
          eyebrow="Player vs Engine"
          title={BOT.label}
          description={BOT.blurb}
        >
          <div className="flex flex-1 flex-col items-center justify-center">
            <DifficultyPicker value={difficulty} onChange={setDifficulty} disabled={busy} />
            <button
              type="button"
              disabled={busy || bot.starting}
              onClick={() => bot.start({ timeControl: resolveTime(pvpTime), difficulty })}
              className={cn(ACTION_BLUE, 'mt-8 w-full')}
            >
              {bot.starting ? 'Starting…' : 'Play Stockfish'}
            </button>
            {/* Never blocks the button: it only explains a refusal in advance if `GET /` did not report the engine. */}
            {homeStatus === 'ready' && !capabilities.bot && (
              <p className="font-mono text-xs text-slate-500">
                The server has not reported the engine as ready — it will answer if it cannot start the game.
              </p>
            )}
          </div>
        </ModeCard>

        <article className={GLASS}>
          <Kicker dot="bg-amber-400/80">Training</Kicker>
          <h2 className="text-xl font-semibold tracking-tight text-white">Tactical Puzzles</h2>
          <p className="mt-1 flex-1 text-xs font-normal leading-relaxed text-slate-400">
            Unlimited tactics that climb from easy to hard. Miss a move and a fresh easy puzzle takes its place.
          </p>
          <Link to="/puzzles" className={cn(ACTION_AMBER, 'mt-5')}>
            Start Solving Puzzles
          </Link>
        </article>
      </section>

      {/* Only when something is running: lets you rejoin your own game or watch another one. */}
      {live.games.length > 0 && (
        <section className="mt-8 space-y-3 animate-fade" aria-label="Games in progress">
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
        <p className="mt-8 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-slate-500">
          <Spinner className="size-3.5" /> Establishing realtime link…
        </p>
      )}
    </div>
  )
}
