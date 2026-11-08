import { describe, it, expect } from 'vitest'
import { explainLine } from './explain'
import { buildLineSteps } from './review'
import type { EvalResult } from '../engine/useEngine'

function evalOf(cp: number | null, mate: number | null = null): EvalResult {
  return {
    cp, mate, bestMoveSan: null, pv: null,
    secondBestCp: null, secondBestMoveSan: null, thirdBestCp: null, thirdBestMoveSan: null,
  }
}

function explain(fen: string, pv: string, ev: EvalResult | null) {
  return explainLine(fen, buildLineSteps(fen, pv), ev)
}

describe('explainLine', () => {
  it('names the material a line wins, and the capture that wins it', () => {
    expect(explain('3q3k/8/8/8/8/8/8/3QK3 w - - 0 1', 'Qxd8+ Kh7', evalOf(900))).toBe('Qxd8+ wins the queen.')
    expect(explain('r3k3/8/8/8/8/8/8/4K2Q w - - 0 1', 'Qh8+ Kd7 Qxa8', evalOf(500)))
      .toBe('Qh8+ wins a rook (Qh8+ Kd7 Qxa8).')
  })

  it('reads the line from the side to move when that is Black', () => {
    expect(explain('3qk3/8/8/8/8/8/8/3QK3 b - - 0 1', 'Qxd1+ Kxd1', evalOf(0)))
      .toBe('Qxd1+ keeps the balance.')
  })

  it('announces mate for the side to move', () => {
    expect(explain('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'Ra8#', evalOf(null, 1))).toBe('Ra8# leads to mate in 1.')
    // A mate score for the other side is not this line's mate.
    expect(explain('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'Kf1', evalOf(null, -3))).toBe('Kf1 is the best defense.')
  })

  it('falls back to how the position stands', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    expect(explain(start, 'e4 e5', evalOf(30))).toBe('e4 keeps the balance.')
    expect(explain(start, 'e4 e5', evalOf(150))).toBe('e4 keeps a clear advantage.')
    expect(explain(start, 'e4 e5', null)).toBe('e4 is the strongest continuation.')
  })

  it('is empty without a line', () => {
    expect(explainLine('8/8/8/8/8/8/8/K6k w - - 0 1', [], null)).toBe('')
  })
})
