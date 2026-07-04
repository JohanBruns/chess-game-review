import { describe, it, expect } from 'vitest'
import { attemptMove, isBestMove } from './retry'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('attemptMove', () => {
  it('returns the SAN and resulting FEN for a legal move', () => {
    const result = attemptMove(START_FEN, 'e2', 'e4')
    expect(result).not.toBeNull()
    expect(result!.san).toBe('e4')
    expect(result!.fenAfter.startsWith('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR')).toBe(true)
  })

  it('returns null for an illegal move (pawn cannot jump three squares)', () => {
    expect(attemptMove(START_FEN, 'e2', 'e5')).toBeNull()
  })

  it("returns null when moving the side that isn't to move", () => {
    // START_FEN has White to move — e7-e5 is Black's pawn push.
    expect(attemptMove(START_FEN, 'e7', 'e5')).toBeNull()
  })

  it('returns null for a from-square with no piece', () => {
    expect(attemptMove(START_FEN, 'e4', 'e5')).toBeNull()
  })

  it('auto-queens a pawn promotion (no promotion-choice UI)', () => {
    // White pawn one step from promotion, otherwise-empty board.
    const fen = '8/P6k/8/8/8/8/7K/8 w - - 0 1'
    const result = attemptMove(fen, 'a7', 'a8')
    expect(result).not.toBeNull()
    expect(result!.san).toBe('a8=Q')
  })
})

describe('isBestMove', () => {
  it('returns true for an exact SAN match', () => {
    expect(isBestMove('Nf3', 'Nf3')).toBe(true)
  })

  it('returns false for a mismatch', () => {
    expect(isBestMove('Nc3', 'Nf3')).toBe(false)
  })

  it('returns null (unknown) when bestMoveSan is null, not false', () => {
    expect(isBestMove('Nf3', null)).toBeNull()
  })
})
