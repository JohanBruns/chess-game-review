import { describe, it, expect } from 'vitest'
import { fenToPlacements, squarePixelRect } from './boardImage'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('fenToPlacements', () => {
  it('lists all 32 pieces from the starting position', () => {
    const placements = fenToPlacements(START_FEN)
    expect(placements).toHaveLength(32)
  })

  it('assigns the correct pieceKey per square', () => {
    const placements = fenToPlacements(START_FEN)
    const bySquare = Object.fromEntries(placements.map(p => [p.square, p.pieceKey]))
    expect(bySquare.e1).toBe('wK')
    expect(bySquare.e8).toBe('bK')
    expect(bySquare.a1).toBe('wR')
    expect(bySquare.h8).toBe('bR')
    expect(bySquare.d2).toBe('wP')
  })

  it('reflects a mid-game FEN, not just the starting position', () => {
    const fen = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3'
    const placements = fenToPlacements(fen)
    expect(placements).toHaveLength(32)
    const bySquare = Object.fromEntries(placements.map(p => [p.square, p.pieceKey]))
    expect(bySquare.e4).toBe('wP')
    expect(bySquare.e5).toBe('bP')
    expect(bySquare.f3).toBe('wN')
    expect(bySquare.f6).toBe('bN')
  })
})

describe('squarePixelRect', () => {
  it('places a1 at the bottom-left for White orientation', () => {
    const rect = squarePixelRect('a1', 'white', 800)
    expect(rect).toEqual({ x: 0, y: 700, size: 100 })
  })

  it('places h8 at the top-right for White orientation', () => {
    const rect = squarePixelRect('h8', 'white', 800)
    expect(rect).toEqual({ x: 700, y: 0, size: 100 })
  })

  it('mirrors both axes for Black orientation', () => {
    // a1 (White's near-left corner) becomes the top-right square when viewed from Black's side.
    expect(squarePixelRect('a1', 'black', 800)).toEqual({ x: 700, y: 0, size: 100 })
    expect(squarePixelRect('h8', 'black', 800)).toEqual({ x: 0, y: 700, size: 100 })
  })

  it('scales with boardSize', () => {
    expect(squarePixelRect('a1', 'white', 400)).toEqual({ x: 0, y: 350, size: 50 })
  })
})
