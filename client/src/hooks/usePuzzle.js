import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { ApiError, puzzlesApi } from '../lib/api'

const NEXT_TIER = { easy: 'medium', medium: 'hard', hard: 'hard' }

const asLine = (solution) => (Array.isArray(solution) ? solution : [])

const playUci = (chess, uci) =>
  chess.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : undefined,
  })

/**
 * Unlimited tactics. A finished line climbs easy → medium → hard.
 * A wrong move snaps back to a fresh easy puzzle.
 */
export function usePuzzle() {
  const [difficulty, setDifficulty] = useState('easy')
  const [puzzle, setPuzzle] = useState(null)
  const [fen, setFen] = useState('')
  const [status, setStatus] = useState('loading')
  const [notice, setNotice] = useState('')
  const [flash, setFlash] = useState(false)
  const [error, setError] = useState('')

  const puzzleRef = useRef(null)
  const fenRef = useRef('')
  const stepRef = useRef(0)
  const lockRef = useRef(false)
  const mountedRef = useRef(true)
  const timersRef = useRef(new Set())

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) clearTimeout(id)
    timersRef.current.clear()
  }, [])

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      if (mountedRef.current) fn()
    }, ms)
    timersRef.current.add(id)
  }, [])

  const applyPuzzle = useCallback((next) => {
    const line = asLine(next.solution)
    const ready = { ...next, solution: line, solver: new Chess(next.fen).turn() }
    puzzleRef.current = ready
    fenRef.current = ready.fen
    stepRef.current = 0
    lockRef.current = false
    setPuzzle(ready)
    setFen(ready.fen)
    setNotice('')
    setError('')
    setStatus('solving')
  }, [])

  const load = useCallback(
    async (tier, excludeId, signal) => {
      setStatus('loading')
      setError('')
      const data = await puzzlesApi.random(tier, excludeId, signal)
      if (!mountedRef.current || signal?.aborted) return
      applyPuzzle(data.puzzle)
    },
    [applyPuzzle],
  )

  useEffect(() => {
    mountedRef.current = true
    const controller = new AbortController()
    load('easy', null, controller.signal).catch((err) => {
      if (err?.name === 'AbortError' || !mountedRef.current) return
      setStatus('error')
      setError(err instanceof ApiError ? err.message : 'The puzzle board could not be loaded.')
    })
    return () => {
      mountedRef.current = false
      controller.abort()
      clearTimers()
    }
  }, [load, clearTimers])

  const requestTier = useCallback(
    (tier, excludeId) => {
      const controller = new AbortController()
      load(tier, excludeId, controller.signal).catch((err) => {
        if (err?.name === 'AbortError' || !mountedRef.current) return
        setStatus('error')
        setError(err instanceof ApiError ? err.message : 'The next puzzle could not be loaded.')
      })
    },
    [load],
  )

  const fail = useCallback(() => {
    const current = puzzleRef.current
    if (!current || lockRef.current) return false
    lockRef.current = true
    setFlash(true)
    setNotice('Incorrect Move! Shuffling back to a new basic puzzle...')
    setDifficulty('easy')
    later(() => setFlash(false), 700)
    requestTier('easy', current.id)
    return false
  }, [later, requestTier])

  const succeed = useCallback(
    (tier) => {
      const nextTier = NEXT_TIER[tier] ?? 'hard'
      lockRef.current = true
      setStatus('success')
      setNotice('Tactical Vision Perfect!')
      setDifficulty(nextTier)
      later(() => requestTier(nextTier, null), 1500)
    },
    [later, requestTier],
  )

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }) => {
      const current = puzzleRef.current
      if (!current || !targetSquare || lockRef.current) return false

      const expected = current.solution[stepRef.current]
      if (!expected) return false

      const chess = new Chess(fenRef.current)
      const piece = chess.get(sourceSquare)
      const needsPromotion = piece?.type === 'p' && (targetSquare[1] === '8' || targetSquare[1] === '1')
      let move
      try {
        move = chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: needsPromotion ? expected[4] || 'q' : undefined,
        })
      } catch {
        return false
      }
      if (!move) return false

      const played = move.from + move.to + (move.promotion || '')
      if (played !== expected) return fail()

      let index = stepRef.current + 1
      while (index < current.solution.length && chess.turn() !== current.solver) {
        try {
          playUci(chess, current.solution[index])
        } catch {
          break
        }
        index += 1
      }

      fenRef.current = chess.fen()
      stepRef.current = index
      setFen(chess.fen())
      if (index >= current.solution.length) succeed(current.difficulty)
      return true
    },
    [fail, succeed],
  )

  const canDragPiece = useCallback(({ piece }) => {
    const current = puzzleRef.current
    if (!current || lockRef.current) return false
    return piece?.pieceType?.[0] === current.solver
  }, [])

  const retry = useCallback(() => requestTier(difficulty, null), [difficulty, requestTier])

  return {
    difficulty,
    puzzle,
    fen,
    status,
    notice,
    flash,
    error,
    onPieceDrop,
    canDragPiece,
    retry,
  }
}
