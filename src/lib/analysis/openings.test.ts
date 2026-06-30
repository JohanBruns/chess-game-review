import { describe, it, expect } from 'vitest'
import { fenToEpd, detectOpening } from './openings'
import type { Opening } from './openings'

// Ruy Lopez (1. e4 e5 2. Nf3 Nc6 3. Bb5) — EPD = first 4 FEN fields
const RUY_EPD = 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -'
// Sicilian Defence (1. e4 c5) — en passant on c6
const SICILIAN_EPD = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6'

const mockMap = new Map<string, Opening>([
  [RUY_EPD, { eco: 'C60', name: 'Ruy Lopez' }],
  [SICILIAN_EPD, { eco: 'B20', name: 'Sicilian Defence' }],
])

describe('fenToEpd', () => {
  it('strips halfmove and fullmove counters', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    expect(fenToEpd(fen)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3')
  })

  it('returns 4-field string', () => {
    const epd = fenToEpd('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(epd.split(' ')).toHaveLength(4)
  })
})

describe('detectOpening', () => {
  it('returns null when no FENs match', () => {
    expect(detectOpening(['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'], mockMap)).toBeNull()
  })

  it('returns correct opening when FEN matches', () => {
    // Full FEN = EPD + halfmove + fullmove
    const fens = [`${RUY_EPD} 1 3`]
    const result = detectOpening(fens, mockMap)
    expect(result).not.toBeNull()
    expect(result!.opening.eco).toBe('C60')
    expect(result!.opening.name).toBe('Ruy Lopez')
  })

  it('returns deepest (last) match when multiple FENs match', () => {
    const fens = [
      `${SICILIAN_EPD} 0 2`,
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      `${RUY_EPD} 1 3`,
    ]
    const result = detectOpening(fens, mockMap)
    expect(result!.opening.eco).toBe('C60')
    expect(result!.fenPly).toBe(2)
  })

  it('fenPly is the correct index in fens[]', () => {
    const fens = [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      `${SICILIAN_EPD} 0 2`,
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    ]
    const result = detectOpening(fens, mockMap)
    expect(result!.fenPly).toBe(1)
  })

  it('returns null for empty fens array', () => {
    expect(detectOpening([], mockMap)).toBeNull()
  })
})
