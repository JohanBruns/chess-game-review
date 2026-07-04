import { describe, it, expect } from 'vitest'
import type { EvalResult } from '../engine/useEngine'
import { getEngineLines } from './lines'

const ev = (overrides: Partial<EvalResult>): EvalResult => ({
  cp: null,
  mate: null,
  bestMoveSan: null,
  pv: null,
  secondBestCp: null,
  secondBestMoveSan: null,
  thirdBestCp: null,
  thirdBestMoveSan: null,
  ...overrides,
})

describe('getEngineLines', () => {
  it('returns an empty array for null input', () => {
    expect(getEngineLines(null)).toEqual([])
  })

  it('maps all three lines in best-first order', () => {
    const result = ev({
      cp: 50, bestMoveSan: 'e4',
      secondBestCp: 30, secondBestMoveSan: 'Nf3',
      thirdBestCp: 10, thirdBestMoveSan: 'd4',
    })
    expect(getEngineLines(result)).toEqual([
      { san: 'e4', cp: 50, mate: false },
      { san: 'Nf3', cp: 30, mate: false },
      { san: 'd4', cp: 10, mate: false },
    ])
  })

  it('drops lines whose move is unknown (null SAN)', () => {
    const result = ev({ cp: 50, bestMoveSan: 'e4', secondBestMoveSan: null, thirdBestMoveSan: null })
    expect(getEngineLines(result)).toEqual([{ san: 'e4', cp: 50, mate: false }])
  })

  it('flags the ±10000 mate sentinel as mate', () => {
    const result = ev({ cp: 10000, bestMoveSan: 'Qh5#' })
    expect(getEngineLines(result)).toEqual([{ san: 'Qh5#', cp: 10000, mate: true }])
  })

  it('flags a losing mate sentinel (-10000) as mate too', () => {
    const result = ev({ cp: -10000, bestMoveSan: 'Kg1' })
    expect(getEngineLines(result)).toEqual([{ san: 'Kg1', cp: -10000, mate: true }])
  })
})
