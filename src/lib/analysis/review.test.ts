import { describe, it, expect } from 'vitest'
import { reviewHeadline, formatEvalBadge, buildLineSteps, buildBestPreview } from './review'
import type { EvalResult } from '../engine/useEngine'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function evalResult(overrides: Partial<EvalResult>): EvalResult {
  return {
    cp: null,
    mate: null,
    bestMoveSan: null,
    pv: null,
    secondBestCp: null,
    secondBestMoveSan: null,
    thirdBestCp: null,
    thirdBestMoveSan: null,
    ...overrides,
  }
}

describe('reviewHeadline', () => {
  it('flags a book move regardless of engine-best status', () => {
    expect(reviewHeadline('e4', 'Book', false)).toBe('e4 is a book move')
  })

  it('says "is best" when the played move equals the engine best', () => {
    expect(reviewHeadline('O-O', 'Blunder', true)).toBe('O-O is best')
  })

  it('says "is best" when classification itself is Best, even if isEnginesBest is false', () => {
    expect(reviewHeadline('Nf3', 'Best', false)).toBe('Nf3 is best')
  })

  it('renders the miss phrase', () => {
    expect(reviewHeadline('Qxg4', 'Miss', false)).toBe('Qxg4 is a miss')
  })

  it('renders the inaccuracy phrase with correct article', () => {
    expect(reviewHeadline('e4', 'Inaccuracy', false)).toBe('e4 is an inaccuracy')
  })

  it('renders the blunder phrase', () => {
    expect(reviewHeadline('d6', 'Blunder', false)).toBe('d6 is a blunder')
  })
})

describe('formatEvalBadge', () => {
  it('formats a positive cp value in pawns', () => {
    expect(formatEvalBadge(evalResult({ cp: 421 }))).toBe('+4.21')
  })

  it('formats a small negative cp value in pawns', () => {
    expect(formatEvalBadge(evalResult({ cp: -9 }))).toBe('-0.09')
  })

  it('formats a positive mate score', () => {
    expect(formatEvalBadge(evalResult({ mate: 5 }))).toBe('M5')
  })

  it('formats a negative mate score', () => {
    expect(formatEvalBadge(evalResult({ mate: -3 }))).toBe('-M3')
  })

  it('returns empty string for null result', () => {
    expect(formatEvalBadge(null)).toBe('')
  })

  it('returns 0.00 when neither cp nor mate is set', () => {
    expect(formatEvalBadge(evalResult({}))).toBe('0.00')
  })
})

describe('buildLineSteps', () => {
  it('resolves a multi-move PV into ordered steps', () => {
    const steps = buildLineSteps(START_FEN, 'e4 e5 Nf3')
    expect(steps).toHaveLength(3)
    expect(steps[0]).toMatchObject({ san: 'e4', from: 'e2', to: 'e4' })
    expect(steps[1]).toMatchObject({ san: 'e5', from: 'e7', to: 'e5' })
    expect(steps[2]).toMatchObject({ san: 'Nf3', from: 'g1', to: 'f3' })
    expect(steps[2].fen).toContain('N')
  })

  it('stops cleanly at the first illegal SAN in the line', () => {
    const steps = buildLineSteps(START_FEN, 'e4 e5 Qh5 Ke7 Bc4 Nf6 Qxf7 illegalmove')
    expect(steps).toHaveLength(7)
    expect(steps[6].san).toBe('Qxf7+')
  })

  it('returns an empty array when pv is null', () => {
    expect(buildLineSteps(START_FEN, null)).toEqual([])
  })

  it('returns an empty array when pv is an empty string', () => {
    expect(buildLineSteps(START_FEN, '')).toEqual([])
  })
})

describe('buildBestPreview', () => {
  it('applies the best move and returns the resulting preview', () => {
    const preview = buildBestPreview(START_FEN, 'e4')
    expect(preview).toMatchObject({ san: 'e4', from: 'e2', to: 'e4' })
    expect(preview?.fen.startsWith('rnbqkbnr/pppppppp/8/8/4P3/8')).toBe(true)
  })

  it('returns null when bestSan is null', () => {
    expect(buildBestPreview(START_FEN, null)).toBeNull()
  })

  it('returns null for an illegal SAN', () => {
    expect(buildBestPreview(START_FEN, 'e5')).toBeNull()
  })
})
