import { describe, it, expect } from 'vitest'
import { Chess, type Move } from 'chess.js'
import { buildMoveAnalyses, playerAccuracy, type MoveAnalysis, type MoveClass } from './classify'
import { detectOpening } from './openings'
import type { EvalResult } from '../engine/uci'
import g171190174548 from './__fixtures__/parity/171190174548.json'
import g147779282758 from './__fixtures__/parity/147779282758.json'
import g170984117356 from './__fixtures__/parity/170984117356.json'
import g170666529854 from './__fixtures__/parity/170666529854.json'
import g170988770322 from './__fixtures__/parity/170988770322.json'
import g173412280300 from './__fixtures__/parity/173412280300.json'
import g172856746274 from './__fixtures__/parity/172856746274.json'
import g172187507640 from './__fixtures__/parity/172187507640.json'
import g171688809516 from './__fixtures__/parity/171688809516.json'
import g184149603540 from './__fixtures__/parity/184149603540.json'
import g184266701180 from './__fixtures__/parity/184266701180.json'
import g172657036964 from './__fixtures__/parity/172657036964.json'
import g171655051226 from './__fixtures__/parity/171655051226.json'
import g171330597782 from './__fixtures__/parity/171330597782.json'
import g184611401806 from './__fixtures__/parity/184611401806.json'
import g183964542178 from './__fixtures__/parity/183964542178.json'
import g173756714744 from './__fixtures__/parity/173756714744.json'
import g172536947728 from './__fixtures__/parity/172536947728.json'
import g173675004502 from './__fixtures__/parity/173675004502.json'
import g174288505864 from './__fixtures__/parity/174288505864.json'

// chess.com parity regression: real games whose Brilliant/Great verdicts were checked against a
// live chess.com Game Review, replayed through the exact pipeline App.tsx runs (opening
// detection → buildMoveAnalyses with the players' Elo). The engine evals are frozen fixtures
// (captured with the shipped Stockfish build, `npm run capture:parity`), so this tests the
// classification heuristics alone — any classify.ts change that breaks a verified verdict fails
// here instead of needing a manual browser comparison.

interface Fixture {
  id: string
  whiteElo: number | null
  blackElo: number | null
  sans: string[]
  evalResults: EvalResult[]
}

function analyze(fixture: Fixture) {
  const chess = new Chess()
  for (const san of fixture.sans) chess.move(san)
  const moves = chess.history({ verbose: true }) as Move[]
  const fens = [moves[0].before, ...moves.map(m => m.after)]
  const openingPly = detectOpening(fens)?.fenPly ?? 0
  const analyses = buildMoveAnalyses(
    moves, fixture.evalResults, openingPly, fixture.whiteElo ?? undefined, fixture.blackElo ?? undefined,
  )
  const label = (a: MoveAnalysis) =>
    `${Math.floor(a.moveIndex / 2) + 1}${a.moveIndex % 2 === 0 ? '.' : '...'}${moves[a.moveIndex].san}`
  const withClass = (cls: MoveClass) => analyses.filter(a => a.classification === cls).map(label)
  return { analyses, brilliant: withClass('Brilliant'), great: withClass('Great') }
}

// One letter per ply — a compact, reviewable snapshot of the whole classification.
const CLASS_CODE: Record<MoveClass, string> = {
  Book: 'k', Brilliant: '!', Great: 'G', Best: 'B', Excellent: 'E', Good: 'g',
  Inaccuracy: 'i', Mistake: 'm', Blunder: 'X', Miss: 'x', Forced: 'f',
}

describe('chess.com parity (Brilliant/Great)', () => {
  it('171190174548: no Brilliant, Great exactly on the three refutations', () => {
    const { brilliant, great } = analyze(g171190174548)
    expect(brilliant).toEqual([])
    expect(great).toEqual(['22.Bxf8', '29...Kg6', '33.Rc4'])
  })

  it('147779282758: 10...Bxh2+ is Brilliant', () => {
    expect(analyze(g147779282758).brilliant).toContain('10...Bxh2+')
  })

  it('170984117356: 24.Qf8+ is Brilliant, 22.Rxf7 is Great', () => {
    const { brilliant, great } = analyze(g170984117356)
    expect(brilliant).toContain('24.Qf8+')
    expect(great).toContain('22.Rxf7')
  })

  it('170666529854: 6.Nxf7 (Fried Liver) is Brilliant despite being book', () => {
    expect(analyze(g170666529854).brilliant).toContain('6.Nxf7')
  })
})

// Brilliant verdicts read off chess.com's Game Review (2026-11) — the complete list per game, so
// an extra Brilliant fails as much as a missing one. Not covered yet: 14.Bh6 in 171300157032,
// which our depth-15 search rates 3.6 win% below the best move.
describe('chess.com parity (Brilliant, exact)', () => {
  const cases: [Fixture, string[], string][] = [
    [g173412280300, ['18...Nb4'], 'knight offered to the queen, declined'],
    [g172856746274, ['23.Nf6+'], 'forking check, declined'],
    [g172187507640, ['15.Bxh6'], 'bishop for two pawns, recaptured by the queen'],
    [g171688809516, ['6.Ne4'], 'opening knight offer'],
    [g184149603540, ['25...Rad8+'], 'exchange sac; 50...f1=Q is a promotion'],
    [g184266701180, ['26.Rxf5'], 'mates everywhere; 27.Qxf7+ skipped Qd8#'],
    [g172657036964, ['16...Qd1+'], 'queen sac into mate'],
    [g171655051226, [], '39...Rxc2+ wins the rook back with Bxa1'],
    [g171330597782, [], '19...Rxe6 only returns the exchange to a fork'],
    [g184611401806, [], '...Bg3+ is a discovered check: fxg3 is illegal'],
    [g183964542178, [], '26.Rf5+ is a discovered check'],
    [g173756714744, [], '35.Rf7+ is a discovered check'],
    [g172536947728, [], '43...c1=Q is a promotion'],
    [g173675004502, [], '38.e8=Q is a promotion'],
    [g174288505864, [], '32.Bxb7 with the 2nd-best line already +7'],
  ]
  for (const [game, expected, why] of cases) {
    it(`${game.id}: ${expected.length ? expected.join(', ') : 'none'} (${why})`, () => {
      expect(analyze(game).brilliant).toEqual(expected)
    })
  }
})

describe('classification snapshot', () => {
  // Not chess.com-verified beyond the tests above — a regression net. A change here is either
  // intended (re-check the affected moves, then `vitest -u`) or a bug.
  const games: Fixture[] = [g171190174548, g147779282758, g170984117356, g170666529854, g170988770322]
  for (const game of games) {
    it(game.id, () => {
      const { analyses } = analyze(game)
      const accuracy = (side: 'white' | 'black') => {
        const acc = playerAccuracy(analyses, side)
        return acc == null ? null : Math.round(acc * 10) / 10
      }
      expect({
        classes: analyses.map(a => CLASS_CODE[a.classification]).join(''),
        accuracy: { white: accuracy('white'), black: accuracy('black') },
      }).toMatchSnapshot()
    })
  }
})
