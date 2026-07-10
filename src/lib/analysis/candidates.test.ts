import { describe, it, expect } from 'vitest'
import { Chess, type Move } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'
import { selectRefinementCandidates } from './candidates'

const ev = (over: Partial<EvalResult> = {}): EvalResult => ({
  cp: 0,
  mate: null,
  bestMoveSan: null,
  pv: null,
  secondBestCp: null,
  secondBestMoveSan: null,
  thirdBestCp: null,
  thirdBestMoveSan: null,
  ...over,
})

function playMoves(sans: string[], startFen?: string): Move[] {
  const chess = startFen ? new Chess(startFen) : new Chess()
  return sans.map(san => chess.move(san))
}

describe('selectRefinementCandidates', () => {
  it('returns nothing for quiet non-best moves with small loss', () => {
    const moves = playMoves(['e4', 'e5'])
    const results = [
      ev({ cp: 30, bestMoveSan: 'd4' }),
      ev({ cp: 25, bestMoveSan: 'Nf6' }),
      ev({ cp: 30 }),
    ]
    expect(selectRefinementCandidates(moves, results)).toEqual([])
  })

  it('selects the before-position of an engine-best move (Great gates need secondBestCp)', () => {
    const moves = playMoves(['e4', 'e5'])
    const results = [
      ev({ cp: 30, bestMoveSan: 'e4' }),
      ev({ cp: 25, bestMoveSan: 'Nf6' }),
      ev({ cp: 30 }),
    ]
    expect(selectRefinementCandidates(moves, results)).toEqual([0])
  })

  it('selects both positions around a large win%-loss (error precision + puzzle gap)', () => {
    const moves = playMoves(['e4', 'e5'])
    // Black's e5 drops the mover-perspective eval from -30 (white view +30) to +250 white view:
    // loss well above the 8-point candidate threshold.
    const results = [
      ev({ cp: 30, bestMoveSan: 'd4' }),
      ev({ cp: 30, bestMoveSan: 'Nf6' }),
      ev({ cp: 250 }),
    ]
    expect(selectRefinementCandidates(moves, results)).toEqual([1, 2])
  })

  it('retries positions whose pass-1 result is missing', () => {
    const moves = playMoves(['e4', 'e5'])
    const results = [ev({ cp: 30, bestMoveSan: 'd4' }), null, ev({ cp: 30 })]
    expect(selectRefinementCandidates(moves, results)).toEqual([1])
  })

  it('selects both positions around a sacrifice (Brilliant gates + PV-confirmation)', () => {
    // Rxd5: rook takes a pawn defended by the e6 pawn — a clear SEE sacrifice.
    const moves = playMoves(['Rxd5'], 'k7/8/4p3/3p4/8/8/3R4/K7 w - - 0 1')
    const results = [ev({ cp: 40, bestMoveSan: 'Kb1' }), ev({ cp: 35 })]
    expect(selectRefinementCandidates(moves, results)).toEqual([0, 1])
  })

  it('deduplicates and sorts indices across overlapping rules', () => {
    const moves = playMoves(['e4', 'e5', 'Nf3'])
    const results = [
      ev({ cp: 30, bestMoveSan: 'e4' }),   // engine best → 0
      ev({ cp: 30, bestMoveSan: 'Nf6' }),  // e5 loses big → 1, 2
      ev({ cp: 250, bestMoveSan: 'Nf3' }), // engine best → 2 (dup)
      ev({ cp: 245 }),
    ]
    expect(selectRefinementCandidates(moves, results)).toEqual([0, 1, 2])
  })
})
