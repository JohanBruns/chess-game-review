import { describe, it, expect } from 'vitest'
import { extractPuzzles, PUZZLE_GAP_MIN } from './puzzles'
import type { EvalResult } from '../engine/useEngine'
import type { MoveAnalysis, MoveClass } from './classify'

const ev = (cp: number, secondBestCp: number | null, bestMoveSan: string | null): EvalResult => ({
  cp,
  mate: null,
  bestMoveSan,
  pv: null,
  secondBestCp,
  secondBestMoveSan: null,
  thirdBestCp: null,
  thirdBestMoveSan: null,
})

const analysis = (moveIndex: number, classification: MoveClass): MoveAnalysis => ({
  moveIndex,
  lossInWinPct: 0,
  classification,
  accuracy: 100,
})

// A minimal fen list — extractPuzzles only reads fens[i] verbatim, so identity strings are fine.
const fens = Array.from({ length: 6 }, (_, i) => `fen${i}`)

describe('extractPuzzles', () => {
  it('keeps a clear-cut blunder with a unique best reply', () => {
    const moves = [{ san: 'Qxg4' }]
    const evals = [ev(500, 100, 'Rxf7')] // gap 400 >= 100
    const puzzles = extractPuzzles(moves, fens, evals, [analysis(0, 'Blunder')])
    expect(puzzles).toEqual([
      { moveIndex: 0, fenBefore: 'fen0', bestSan: 'Rxf7', playedSan: 'Qxg4', classification: 'Blunder' },
    ])
  })

  it('drops non-mistake classifications', () => {
    const moves = [{ san: 'Nf3' }, { san: 'Bb5' }]
    const evals = [ev(500, 100, 'Rxf7'), ev(500, 100, 'Qd8')]
    const puzzles = extractPuzzles(moves, fens, evals, [analysis(0, 'Best'), analysis(1, 'Good')])
    expect(puzzles).toEqual([])
  })

  it('drops positions where the best move is not clearly better than the second-best', () => {
    const moves = [{ san: 'Qxg4' }]
    const evals = [ev(120, 80, 'Rxf7')] // gap 40 < 100
    expect(extractPuzzles(moves, fens, evals, [analysis(0, 'Mistake')])).toEqual([])
  })

  it('respects a custom gap threshold', () => {
    const moves = [{ san: 'Qxg4' }]
    const evals = [ev(120, 80, 'Rxf7')] // gap 40
    const puzzles = extractPuzzles(moves, fens, evals, [analysis(0, 'Mistake')], { gapMinCp: 30 })
    expect(puzzles).toHaveLength(1)
  })

  it('computes the gap by magnitude so a black-to-move position (negated cp) still qualifies', () => {
    const moves = [{ san: 'Qxg4' }]
    const evals = [ev(-500, -100, 'Rxf7')] // black to move: best -500 is worse-looking but gap 400
    expect(extractPuzzles(moves, fens, evals, [analysis(0, 'Blunder')])).toHaveLength(1)
  })

  it('skips positions with no engine reference or no second-best line', () => {
    const moves = [{ san: 'a' }, { san: 'b' }]
    const noBest = ev(500, 100, null)
    const noSecond = ev(500, null, 'Rxf7')
    expect(
      extractPuzzles(moves, fens, [noBest, noSecond], [analysis(0, 'Blunder'), analysis(1, 'Blunder')]),
    ).toEqual([])
  })

  it('skips a "mistake" that somehow equals the best move', () => {
    const moves = [{ san: 'Rxf7' }]
    const evals = [ev(500, 100, 'Rxf7')]
    expect(extractPuzzles(moves, fens, evals, [analysis(0, 'Mistake')])).toEqual([])
  })

  it('returns multiple puzzles in game order', () => {
    const moves = [{ san: 'e4' }, { san: 'Qxg4' }, { san: 'Nf6' }, { san: 'Bxh7' }]
    const evals = [
      ev(20, 10, 'd4'),        // Best move, not a mistake → skip
      ev(600, 50, 'Rxf7'),     // Blunder, gap 550 → keep
      ev(30, 20, 'O-O'),       // Mistake but gap 10 → skip
      ev(-400, -900, 'Qh5'),   // Miss, gap 500 → keep
    ]
    const analyses = [
      analysis(0, 'Best'),
      analysis(1, 'Blunder'),
      analysis(2, 'Mistake'),
      analysis(3, 'Miss'),
    ]
    const puzzles = extractPuzzles(moves, fens, evals, analyses)
    expect(puzzles.map(p => p.moveIndex)).toEqual([1, 3])
    expect(puzzles[0].bestSan).toBe('Rxf7')
    expect(puzzles[1].bestSan).toBe('Qh5')
  })

  it('uses the documented default gap threshold', () => {
    expect(PUZZLE_GAP_MIN).toBe(100)
  })
})
