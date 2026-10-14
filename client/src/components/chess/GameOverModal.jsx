import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSocket } from '../../hooks/useSocket'
import { gamesApi, matchmakingApi } from '../../lib/api'
import { cn } from '../../lib/cn'
import { describeOutcome, resolveVerdict } from '../../lib/chess'
import { EVENTS, TIME_CONTROLS } from '../../lib/config'
import { eloSide } from '../../lib/elo'
import { lastGame, queue } from '../../lib/storage'
import { SearchIcon } from '../ui/Icons'
import { Modal } from '../ui/Modal'
import { EloChange } from './EloChange'

const PANEL =
  'w-full max-w-sm rounded-2xl border border-slate-800/80 bg-[#0F1524]/90 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl'

const MODAL_ACTION =
  'flex w-full flex-1 items-center justify-center rounded-xl border border-slate-800/80 bg-[#161F32]/40 py-3 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-300 transition-all duration-300'

const REVIEW = cn(
  MODAL_ACTION,
  'hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400 hover:shadow-[0_4px_20px_rgba(16,185,129,0.1)] active:scale-[0.99]',
)

const REMATCH = cn(
  MODAL_ACTION,
  'hover:border-indigo-500/40 hover:bg-indigo-500/10 hover:text-indigo-400 hover:shadow-[0_4px_20px_rgba(99,102,241,0.1)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50',
)

const NEW_OPPONENT = cn(
  MODAL_ACTION,
  'gap-2 hover:border-slate-700/80 hover:bg-slate-900/60 hover:text-white hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50',
)

const FOOTER =
  'flex w-full flex-row items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 sm:text-[11px]'

const NAV_LINK = 'cursor-pointer transition-colors duration-200 hover:text-slate-400'

const KNOWN_CLOCKS = new Set(TIME_CONTROLS.map((tc) => tc.id))

function clockId(value) {
  const id = typeof value === 'string' ? value : value?.id
  return KNOWN_CLOCKS.has(id) ? id : null
}

const VERDICTS = {
  win: { title: 'Victory', tone: 'text-emerald-400' },
  loss: { title: 'Defeat', tone: 'text-white' },
  draw: { title: 'Draw', tone: 'text-white' },
}

/** `rematchStatus`: idle | starting (bot) | requesting | waiting | declined | error | unavailable | started */
const REMATCH_NOTES = {
  declined: { text: 'Your opponent declined the rematch.', tone: 'text-red-300/90' },
  unavailable: { text: 'Coming Soon', tone: 'text-slate-500/80' },
}

/**
 * Appears the instant the server emits `game_over`.
 * Shows the rating movement of a ranked game, then analysis, rematch, and a fresh queue
 * that reuses the clock of the game that just ended.
 */
export function GameOverModal({
  open,
  outcome,
  me,
  myColor,
  spectating,
  timeControl,
  ranked,
  gameMode,
  opponentName,
  rematchStatus,
  rematchError,
  onRematch,
  onAnalyze,
  onDismiss,
}) {
  const navigate = useNavigate()
  const { socket } = useSocket()
  const verdict = VERDICTS[resolveVerdict(outcome, me)]
  const { reason, message } = describeOutcome(outcome)
  const rivalName = opponentName || outcome?.winner
  const isVsBot = rivalName?.toLowerCase().includes('stockfish') || gameMode === 'bot'
  const waitingForOpponent = rematchStatus === 'requesting' || rematchStatus === 'waiting'
  const rematchBusy = waitingForOpponent || rematchStatus === 'starting' || rematchStatus === 'started'
  const rating = !spectating && outcome?.ranked ? eloSide(outcome.elo, myColor) : null
  const note = rematchStatus === 'error' ? { text: rematchError, tone: 'text-red-300/90' } : REMATCH_NOTES[rematchStatus]

  const [seeking, setSeeking] = useState(false)
  const [queueId, setQueueId] = useState(null)
  const [seekError, setSeekError] = useState('')
  const queueRef = useRef(null)
  const matchedRef = useRef(false)

  useEffect(() => {
    queueRef.current = queueId
  }, [queueId])

  useEffect(() => {
    return () => {
      const id = queueRef.current
      if (!id || matchedRef.current) return
      queue.clear()
      gamesApi.cancelMatchmaking(id).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!queueId) return undefined
    let stopped = false

    const openMatch = (id) => {
      if (stopped || matchedRef.current) return
      matchedRef.current = true
      queue.clear()
      navigate(`/arena/${id}`)
    }

    const onStarted = (payload) => {
      if (!payload?.room_id || payload.room_id === queueId) openMatch(payload?.room_id ?? queueId)
    }
    socket?.on(EVENTS.GAME_STARTED, onStarted)

    const check = async () => {
      try {
        const res = await gamesApi.get(queueId)
        if (!stopped && res?.game?.status === 'in_progress') openMatch(queueId)
      } catch (err) {
        if (!stopped && err?.status === 404) {
          queue.clear()
          setQueueId(null)
          setSeeking(false)
          setSeekError('The search ended before a rival joined.')
        }
      }
    }
    const timer = setInterval(check, 3000)

    return () => {
      stopped = true
      socket?.off(EVENTS.GAME_STARTED, onStarted)
      clearInterval(timer)
    }
  }, [queueId, socket, navigate])

  const findNewPlayer = async () => {
    if (seeking) return
    const stored = lastGame.get()
    const clock = clockId(timeControl) || clockId(stored?.timeControl) || 'blitz'
    const mode = ranked ? 'ranked' : 'casual'
    setSeeking(true)
    setSeekError('')
    try {
      const res =
        mode === 'ranked' ? await matchmakingApi.join({ mode, timeControl: clock }) : await gamesApi.create(clock)
      const game = res?.game
      if (res?.matchmaking?.status === 'matched' && game?.id) {
        matchedRef.current = true
        queue.clear()
        navigate(`/arena/${game.id}`)
        return
      }
      if (!game?.id) {
        setSeeking(false)
        setSeekError('Could not join the queue.')
        return
      }
      queue.set({ id: game.id, time_control: clock, mode })
      setQueueId(game.id)
    } catch (err) {
      setSeeking(false)
      setSeekError(err?.message ?? 'Could not join the queue.')
    }
  }

  return (
    <Modal open={open} onClose={onDismiss} labelledBy="gameover-title" panelClassName={PANEL}>
      <p className="mb-2 block text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500">
        {reason}
        {outcome?.ranked ? ' · Ranked' : ''}
      </p>
      <h2 id="gameover-title" className={cn('mb-1 text-2xl font-bold tracking-tight', spectating ? 'text-white' : verdict.tone)}>
        {spectating ? 'Game over' : verdict.title}
      </h2>
      <p className="mb-6 text-xs font-normal text-slate-400">{message}</p>

      <EloChange side={rating} />

      <div className={cn('flex w-full flex-col gap-4', rating && 'mt-6')}>
        {!spectating && (
          <div className="flex w-full flex-row items-center gap-3">
            <button type="button" onClick={onAnalyze} className={REVIEW}>
              Review Analisis
            </button>
            <button
              type="button"
              onClick={onRematch}
              disabled={rematchBusy}
              aria-busy={rematchBusy}
              className={cn(REMATCH, rematchStatus === 'unavailable' && 'opacity-70')}
            >
              {waitingForOpponent ? 'Waiting' : rematchBusy ? 'Starting' : 'Rematch'}
            </button>
          </div>
        )}

        {!spectating && note?.text && (
          <p role="status" aria-live="polite" className={cn('font-mono text-[11px] uppercase tracking-widest', note.tone)}>
            {note.text}
          </p>
        )}

        {!isVsBot && (
          <button type="button" onClick={findNewPlayer} disabled={seeking} aria-busy={seeking} className={NEW_OPPONENT}>
            <SearchIcon className="size-3.5" />
            {seeking ? 'Mencari' : 'Cari Player Baru'}
          </button>
        )}
        {!isVsBot && seekError && <p className="text-xs text-red-300/90">{seekError}</p>}

        <div className={FOOTER}>
          <button type="button" onClick={onDismiss} className={NAV_LINK}>
            View Board
          </button>
          <button type="button" onClick={() => navigate('/lobby')} className={NAV_LINK}>
            Kembali ke Lobby
          </button>
        </div>
      </div>
    </Modal>
  )
}
