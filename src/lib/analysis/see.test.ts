import { describe, it, expect } from 'vitest'
import { seeGain, PIECE_VAL } from './see'

describe('PIECE_VAL', () => {
  it('uses standard pawn-unit values', () => {
    expect(PIECE_VAL).toEqual({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 })
  })
})

describe('seeGain', () => {
  it('returns 0 for a square nothing can capture on', () => {
    expect(seeGain('4k3/8/8/3n4/8/8/8/4K3 w - - 0 1', 'a1')).toBe(0)
  })

  it('undefended piece → its full value', () => {
    // Rd1 takes the undefended knight on d5, no recapture.
    expect(seeGain('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', 'd5')).toBe(3)
  })

  it('defended piece taken by a MORE valuable attacker → 0 (capturing loses, so decline)', () => {
    // Rxd5 exd5 would trade rook for knight (3 - 5 = -2) — the side to move declines.
    expect(seeGain('4k3/8/4p3/3n4/8/8/8/3RK3 w - - 0 1', 'd5')).toBe(0)
  })

  it('defended piece taken by a CHEAPER attacker → the exchange profit', () => {
    // exd5 (wins the knight) exd5 (loses the pawn): 3 - 1 = 2.
    expect(seeGain('4k3/8/4p3/3n4/4P3/8/8/4K3 w - - 0 1', 'd5')).toBe(2)
  })

  it('pinned defender cannot recapture → full value despite the "defense"', () => {
    // The e6 pawn nominally defends d5, but it is pinned to the king on c8 by the
    // h3 bishop — exd5 is illegal, so Rxd5 wins the knight outright. Legality-based
    // SEE gets this right where a classic attacker-count swap algorithm would not.
    expect(seeGain('2k5/8/4p3/3n4/8/7B/8/3RK3 w - - 0 1', 'd5')).toBe(3)
  })

  it('picks the least valuable attacker first', () => {
    // Both Qd1 and the e4 pawn attack d5 (knight defended by e6 pawn). Queen-first
    // loses material and would be declined (result 0); pawn-first runs exd5 exd5
    // Qxd5 and nets knight + pawn for a pawn = 3.
    expect(seeGain('4k3/8/4p3/3n4/4P3/8/8/3QK3 w - - 0 1', 'd5')).toBe(3)
  })

  it('returns 0 for an invalid FEN instead of throwing', () => {
    expect(seeGain('not a fen', 'e4')).toBe(0)
  })
})
