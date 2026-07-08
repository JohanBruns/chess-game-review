import { describe, it, expect } from 'vitest'
import { classificationCounts, phaseGrade, buildGameSummary } from './summary'
import type { MoveAnalysis, MoveClass, GamePhase } from './classify'

const analysis = (
  moveIndex: number,
  classification: MoveClass,
  phase: GamePhase = 'middlegame',
): MoveAnalysis => ({ moveIndex, lossInWinPct: 0, classification, accuracy: 100, phase })

describe('classificationCounts', () => {
  it('counts only the given player\'s moves, by classification', () => {
    const analyses: MoveAnalysis[] = [
      analysis(0, 'Best'),   // white
      analysis(1, 'Blunder'), // black
      analysis(2, 'Best'),   // white
      analysis(3, 'Good'),   // black
    ]
    const white = classificationCounts(analyses, 'white')
    expect(white.Best).toBe(2)
    expect(white.Blunder).toBe(0)
    expect(white.Good).toBe(0)

    const black = classificationCounts(analyses, 'black')
    expect(black.Blunder).toBe(1)
    expect(black.Good).toBe(1)
    expect(black.Best).toBe(0)
  })

  it('includes every MoveClass key, defaulting to 0', () => {
    const counts = classificationCounts([], 'white')
    expect(counts.Book).toBe(0)
    expect(counts.Brilliant).toBe(0)
    expect(counts.Forced).toBe(0)
    expect(Object.keys(counts).length).toBe(11)
  })
})

describe('phaseGrade', () => {
  it('returns null for null input', () => {
    expect(phaseGrade(null)).toBeNull()
  })

  it('grades at the documented boundaries', () => {
    expect(phaseGrade(100)).toBe('Great')
    expect(phaseGrade(95)).toBe('Great')
    expect(phaseGrade(94.9)).toBe('Excellent')
    expect(phaseGrade(90)).toBe('Excellent')
    expect(phaseGrade(89.9)).toBe('Good')
    expect(phaseGrade(75)).toBe('Good')
    expect(phaseGrade(74.9)).toBe('Inaccuracy')
    expect(phaseGrade(60)).toBe('Inaccuracy')
    expect(phaseGrade(59.9)).toBe('Mistake')
    expect(phaseGrade(45)).toBe('Mistake')
    expect(phaseGrade(44.9)).toBe('Blunder')
    expect(phaseGrade(0)).toBe('Blunder')
  })
})

describe('buildGameSummary', () => {
  it('aggregates accuracy, phase accuracy/grades, counts, and a game rating', () => {
    const analyses: MoveAnalysis[] = []
    for (let i = 0; i < 40; i++) {
      analyses.push(analysis(i, i % 2 === 0 ? 'Good' : 'Excellent', 'middlegame'))
    }
    const summary = buildGameSummary(analyses, 'white')
    expect(summary.accuracy).not.toBeNull()
    expect(summary.classificationCounts.Good).toBe(20)
    expect(summary.phaseGrades.middlegame).not.toBeNull()
    expect(summary.gameRating).not.toBeNull()
  })

  it('returns null accuracy/rating when there are no qualifying moves', () => {
    const summary = buildGameSummary([], 'white')
    expect(summary.accuracy).toBeNull()
    expect(summary.gameRating).toBeNull()
    expect(summary.phaseGrades.opening).toBeNull()
  })
})
