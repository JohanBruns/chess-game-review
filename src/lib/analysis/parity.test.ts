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
