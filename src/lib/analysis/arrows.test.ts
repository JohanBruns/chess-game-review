import { describe, it, expect } from 'vitest'
import { getBestMoveArrow, getAttackArrows } from './arrows'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('getBestMoveArrow', () => {
  it('resolves a SAN best move to from/to squares', () => {
    expect(getBestMoveArrow(START_FEN, 'e4')).toEqual({ from: 'e2', to: 'e4' })
  })

  it('resolves a knight move', () => {
    expect(getBestMoveArrow(START_FEN, 'Nf3')).toEqual({ from: 'g1', to: 'f3' })
  })

  it('returns null when bestMoveSan is null', () => {
    expect(getBestMoveArrow(START_FEN, null)).toBeNull()
  })

  it('returns null for a SAN that is illegal in the given position', () => {
    expect(getBestMoveArrow(START_FEN, 'e5')).toBeNull()
  })
})

describe('getAttackArrows', () => {
  // White knight just landed on c7: forks the rook on a8 and the king on e8.
  // The knight's own square (c7) is in turn attacked by the black rook on c8.
  const FORK_FEN = 'r1r1k3/2N5/8/8/8/8/8/4K3 w - - 0 1'

  it('finds all enemy pieces the moved piece now attacks (fork)', () => {
    const { attacks } = getAttackArrows(FORK_FEN, 'c7', 'w')
    expect(attacks.sort()).toEqual(['a8', 'e8'])
  })

  it('finds all enemy pieces attacking the destination square', () => {
    const { attackedBy } = getAttackArrows(FORK_FEN, 'c7', 'w')
    expect(attackedBy.sort()).toEqual(['c8'])
  })

  it('returns empty arrays when nothing attacks or is attacked', () => {
    const fen = '4k3/8/8/8/8/8/5P2/4K3 w - - 0 1'
    const { attacks, attackedBy } = getAttackArrows(fen, 'f2', 'w')
    expect(attacks).toEqual([])
    expect(attackedBy).toEqual([])
  })
})
