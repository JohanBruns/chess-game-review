import { useState, useCallback } from 'react'
import { attemptMove } from '../lib/analysis/retry'
import type { Puzzle } from '../lib/analysis/puzzles'

export interface PuzzleAttempt {
  san: string
  to: string
  correct: boolean
  // Position after the attempted move, so the board can show what the user played.
  fen: string
}

export interface PuzzlesView {
  active: boolean
  // The puzzle currently on the board, or null once the session is finished (index past the end).
  current: Puzzle | null
  index: number
  total: number
  solvedCount: number
  finished: boolean
  attempt: PuzzleAttempt | null
  // Set once "Show solution" is used on the current puzzle — the board previews the best move.
  revealed: boolean
  start: (puzzles: Puzzle[]) => void
  exit: () => void
  tryMove: (from: string, to: string) => boolean
  retry: () => void
  reveal: () => void
  next: () => void
}

// Sequential "learn from your mistakes" puzzle flow (Phase 8): walk the puzzles from extractPuzzles
// one at a time, letting the user drag the move they think is best and checking it against the
// engine's known solution (exact-SAN, same bar as retry). Pure state — no engine calls at runtime.
export function usePuzzles(): PuzzlesView {
  const [list, setList] = useState<Puzzle[] | null>(null)
  const [index, setIndex] = useState(0)
  const [attempt, setAttempt] = useState<PuzzleAttempt | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [solvedCount, setSolvedCount] = useState(0)

  const active = list !== null
  const finished = list !== null && index >= list.length
  const current = list && index < list.length ? list[index] : null

  const start = useCallback((puzzles: Puzzle[]) => {
    if (puzzles.length === 0) return
    setList(puzzles)
    setIndex(0)
    setAttempt(null)
    setRevealed(false)
    setSolvedCount(0)
  }, [])

  const exit = useCallback(() => {
    setList(null)
    setIndex(0)
    setAttempt(null)
    setRevealed(false)
    setSolvedCount(0)
  }, [])

  const tryMove = useCallback((from: string, to: string): boolean => {
    if (!current || attempt !== null || revealed) return false
    const result = attemptMove(current.fenBefore, from, to)
    if (!result) return false
    const correct = result.san === current.bestSan
    setAttempt({ san: result.san, to, correct, fen: result.fenAfter })
    if (correct) setSolvedCount(n => n + 1)
    return true
  }, [current, attempt, revealed])

  const retry = useCallback(() => setAttempt(null), [])

  // "Show solution" — give up on the current puzzle and preview the answer. Doesn't count as solved.
  const reveal = useCallback(() => {
    setAttempt(null)
    setRevealed(true)
  }, [])

  const next = useCallback(() => {
    setIndex(i => i + 1)
    setAttempt(null)
    setRevealed(false)
  }, [])

  return {
    active,
    current,
    index,
    total: list?.length ?? 0,
    solvedCount,
    finished,
    attempt,
    revealed,
    start,
    exit,
    tryMove,
    retry,
    reveal,
    next,
  }
}
