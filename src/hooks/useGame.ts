import { useState, useCallback, useRef, useEffect } from 'react'
import { Chess, type Move } from 'chess.js'
import { parseClocks, parseTimeControl, moveTimes as computeMoveTimes } from '../lib/analysis/clocks'

const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface GameData {
  fens: string[]
  moves: Move[]
  error: string | null
  isLoaded: boolean
  whiteElo?: number
  blackElo?: number
  whiteName?: string
  blackName?: string
  result?: string
  // Raw (un-stripped) PGN as loaded — kept for "Copy analysis link" (rebuilding the ?pgn= URL)
  // and because %clk annotations only survive in this, not the comment-stripped copy chess.js parses.
  pgn?: string
  // Per-ply time spent (seconds), same indexing as moves/fens[1..]; null where unknown
  // (no %clk data, or no TimeControl header to seed the first move of a side).
  moveTimeSeconds: (number | null)[]
}

const INITIAL_GAME: GameData = {
  fens: [],
  moves: [],
  error: null,
  isLoaded: false,
  moveTimeSeconds: [],
}

// PGN Elo tags are strings and chess.com uses "?" (or occasionally "0") for unrated/unknown
// games — both should behave as "no rating" (neutral classification thresholds), not as a
// literal 0 rating.
function parseElo(v: string | null | undefined): number | undefined {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function useGame() {
  const [game, setGame] = useState<GameData>(INITIAL_GAME)
  const [currentPly, setCurrentPly] = useState(0)

  // Holds the last COMMITTED ply for when queue() runs before any frame has flushed yet
  // (pendingRef is still null then).
  const currentPlyRef = useRef(currentPly)
  useEffect(() => { currentPlyRef.current = currentPly }, [currentPly])

  const pendingRef = useRef<number | null>(null)   // intended, not-yet-committed target ply
  const rafRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
  }, [])

  const loadPgn = useCallback((pgn: string) => {
    if (!pgn.trim()) {
      setGame((prev) => ({ ...prev, error: 'No PGN entered.' }))
      return
    }
    const chess = new Chess()
    try {
      // chess.com PGNs contain [%clk ...] / [%eval ...] annotations inside
      // brace comments which chess.js 1.x cannot parse — strip them first.
      const cleaned = pgn.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()
      chess.loadPgn(cleaned)
      const moves = chess.history({ verbose: true }) as Move[]
      if (moves.length === 0) {
        setGame((prev) => ({ ...prev, error: 'Invalid PGN: no moves found.' }))
        return
      }
      const fens = [moves[0].before, ...moves.map((m) => m.after)]
      const headers = chess.header()
      const whiteElo = parseElo(headers.WhiteElo)
      const blackElo = parseElo(headers.BlackElo)
      const whiteName = headers.White || undefined
      const blackName = headers.Black || undefined
      const result = headers.Result || undefined
      const clocks = parseClocks(pgn)
      const timeControl = parseTimeControl(headers.TimeControl)
      const moveTimeSeconds = computeMoveTimes(clocks, timeControl)
      setGame({
        fens, moves, error: null, isLoaded: true, whiteElo, blackElo, whiteName, blackName, result,
        pgn, moveTimeSeconds,
      })
      // A new game replaces currentPly synchronously — drop any not-yet-flushed navigation
      // intent from the previous game so it can't overwrite this reset on the next frame.
      pendingRef.current = null
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      setCurrentPly(0)
    } catch (e) {
      setGame((prev) => ({ ...prev, error: String(e) }))
    }
  }, [])

  const flush = useCallback(() => {
    rafRef.current = null
    if (pendingRef.current !== null) {
      setCurrentPly(pendingRef.current)
      pendingRef.current = null
    }
  }, [])

  // Bundles a burst of navigation intents (e.g. OS key-repeat) into one commit per animation
  // frame, so react-chessboard's per-position animation/layout effect never gets interrupted
  // faster than the browser can paint. compute() receives the last intended-or-committed ply.
  const queue = useCallback((compute: (base: number) => number) => {
    const base = pendingRef.current ?? currentPlyRef.current
    pendingRef.current = compute(base)
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush)
  }, [flush])

  const goToFirst = useCallback(() => queue(() => 0), [queue])
  const goToPrev = useCallback(() => queue((p) => Math.max(0, p - 1)), [queue])
  const goToNext = useCallback(
    () => queue((p) => Math.min(game.fens.length - 1, p + 1)),
    [queue, game.fens.length],
  )
  const goToLast = useCallback(() => queue(() => game.fens.length - 1), [queue, game.fens.length])
  // goToPly ignores base on purpose — jumping to a fixed ply always wins over a not-yet-
  // flushed relative move, matching today's behavior where a move-list click jumps immediately.
  const goToPly = useCallback((ply: number) => queue(() => ply), [queue])

  return {
    currentFen: game.fens[currentPly] ?? DEFAULT_POSITION,
    fens: game.fens,
    moves: game.moves,
    currentPly,
    error: game.error,
    isLoaded: game.isLoaded,
    whiteElo: game.whiteElo,
    blackElo: game.blackElo,
    whiteName: game.whiteName,
    blackName: game.blackName,
    result: game.result,
    pgn: game.pgn,
    moveTimeSeconds: game.moveTimeSeconds,
    canGoPrev: currentPly > 0,
    canGoNext: currentPly < game.fens.length - 1,
    loadPgn,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    goToPly,
  }
}
