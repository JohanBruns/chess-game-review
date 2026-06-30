import { useState, useCallback } from 'react'
import { Chess, type Move } from 'chess.js'

const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

interface GameData {
  fens: string[]
  moves: Move[]
  error: string | null
  isLoaded: boolean
}

const INITIAL_GAME: GameData = {
  fens: [],
  moves: [],
  error: null,
  isLoaded: false,
}

export function useGame() {
  const [game, setGame] = useState<GameData>(INITIAL_GAME)
  const [currentPly, setCurrentPly] = useState(0)

  const loadPgn = useCallback((pgn: string) => {
    const chess = new Chess()
    try {
      // chess.com PGNs contain [%clk ...] / [%eval ...] annotations inside
      // brace comments which chess.js 1.x cannot parse — strip them first.
      const cleaned = pgn.replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim()
      chess.loadPgn(cleaned)
      const moves = chess.history({ verbose: true }) as Move[]
      const fens =
        moves.length === 0
          ? [DEFAULT_POSITION]
          : [moves[0].before, ...moves.map((m) => m.after)]
      setGame({ fens, moves, error: null, isLoaded: true })
      setCurrentPly(0)
    } catch (e) {
      setGame((prev) => ({ ...prev, error: String(e) }))
    }
  }, [])

  const goToFirst = useCallback(() => setCurrentPly(0), [])

  const goToPrev = useCallback(
    () => setCurrentPly((p) => Math.max(0, p - 1)),
    [],
  )

  const goToNext = useCallback(
    () => setCurrentPly((p) => Math.min(game.fens.length - 1, p + 1)),
    [game.fens.length],
  )

  const goToLast = useCallback(
    () => setCurrentPly(game.fens.length - 1),
    [game.fens.length],
  )

  const goToPly = useCallback((ply: number) => setCurrentPly(ply), [])

  return {
    currentFen: game.fens[currentPly] ?? DEFAULT_POSITION,
    fens: game.fens,
    moves: game.moves,
    currentPly,
    error: game.error,
    isLoaded: game.isLoaded,
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
