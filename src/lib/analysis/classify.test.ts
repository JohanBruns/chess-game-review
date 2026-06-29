import { describe, it, expect } from 'vitest'
import { winPct, classifyMove } from './classify'

describe('winPct', () => {
  it('returns 50 at cp=0', () => {
    expect(winPct(0)).toBeCloseTo(50, 5)
  })

  it('returns >50 for positive cp', () => {
    expect(winPct(100)).toBeGreaterThan(50)
  })

  it('returns <50 for negative cp', () => {
    expect(winPct(-100)).toBeLessThan(50)
  })

  it('is symmetric: winPct(x) + winPct(-x) === 100', () => {
    expect(winPct(300) + winPct(-300)).toBeCloseTo(100, 10)
    expect(winPct(1000) + winPct(-1000)).toBeCloseTo(100, 10)
  })

  it('winPct(200) ≈ 67.6', () => {
    expect(winPct(200)).toBeCloseTo(67.6, 0)
  })

  it('winPct(1000) ≈ 97.5', () => {
    expect(winPct(1000)).toBeCloseTo(97.5, 0)
  })
})

describe('classifyMove', () => {
  it('returns Best when isEngineBestMove=true, even at loss=0', () => {
    expect(classifyMove(0, true)).toBe('Best')
  })

  it('Best has priority over any loss value', () => {
    expect(classifyMove(50, true)).toBe('Best')
  })

  it('returns Excellent for loss=0, not best move', () => {
    expect(classifyMove(0, false)).toBe('Excellent')
  })

  it('Excellent: loss exactly 2', () => {
    expect(classifyMove(2, false)).toBe('Excellent')
  })

  it('Good: loss just above 2', () => {
    expect(classifyMove(2.001, false)).toBe('Good')
  })

  it('Good: loss exactly 5', () => {
    expect(classifyMove(5, false)).toBe('Good')
  })

  it('Inaccuracy: loss just above 5', () => {
    expect(classifyMove(5.001, false)).toBe('Inaccuracy')
  })

  it('Inaccuracy: loss exactly 10', () => {
    expect(classifyMove(10, false)).toBe('Inaccuracy')
  })

  it('Mistake: loss just above 10', () => {
    expect(classifyMove(10.001, false)).toBe('Mistake')
  })

  it('Mistake: loss exactly 20', () => {
    expect(classifyMove(20, false)).toBe('Mistake')
  })

  it('Blunder: loss just above 20', () => {
    expect(classifyMove(20.001, false)).toBe('Blunder')
  })

  it('Blunder: large loss', () => {
    expect(classifyMove(100, false)).toBe('Blunder')
  })
})
