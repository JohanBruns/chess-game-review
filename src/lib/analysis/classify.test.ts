import { describe, it, expect } from 'vitest'
import { Chess, type Move } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'
import { winPct, classifyMove, isSacrifice, buildMoveAnalyses, moveAccuracy, playerAccuracy, findKeyMoments } from './classify'
import type { MoveAnalysis } from './classify'

// Minimal helpers — buildMoveAnalyses only reads .san from Move and .cp/.mate/.bestMoveSan from EvalResult
const mv = (san: string) => ({ san } as unknown as Move)
const ev = (cp: number, bestMoveSan: string | null = null, secondBestCp: number | null = null): EvalResult => ({
  cp,
  mate: null,
  bestMoveSan,
  pv: null,
  secondBestCp,
})

// A synthetic capture-type "sacrifice" move — isSacrifice's capture branch only reads
// .piece/.captured (never .to/.after), so a cast is safe here (unlike the non-capture
// branch tests below, which need a real board to check attacker/defender squares).
const sacMv = (san: string): Move =>
  ({ san, piece: 'q', captured: 'n', color: 'w', to: 'e4', after: 'x' } as unknown as Move)

describe('winPct', () => {
  it('returns 50 at cp=0', () => {
    expect(winPct(0)).toBeCloseTo(50, 5)
  })

  it('returns >50 for positive cp', () => {
    expect(winPct(100)).toBeGreaterThan(50)
  })

  it('returns <50 for negative cp', () => {
    expect(winPct(-100)).toBeLessThan(50)
  })

  it('is symmetric: winPct(x) + winPct(-x) === 100', () => {
    expect(winPct(300) + winPct(-300)).toBeCloseTo(100, 10)
    expect(winPct(1000) + winPct(-1000)).toBeCloseTo(100, 10)
  })

  it('winPct(200) ≈ 67.6', () => {
    expect(winPct(200)).toBeCloseTo(67.6, 0)
  })

  it('winPct(1000) ≈ 97.5', () => {
    expect(winPct(1000)).toBeCloseTo(97.5, 0)
  })
})

describe('classifyMove', () => {
  it('returns Best when isEngineBestMove=true, even at loss=0', () => {
    expect(classifyMove(0, true)).toBe('Best')
  })

  it('Best has priority over any loss value', () => {
    expect(classifyMove(50, true)).toBe('Best')
  })

  it('returns Excellent for loss=0, not best move', () => {
    expect(classifyMove(0, false)).toBe('Excellent')
  })

  it('Excellent: loss exactly 2', () => {
    expect(classifyMove(2, false)).toBe('Excellent')
  })

  it('Good: loss just above 2', () => {
    expect(classifyMove(2.001, false)).toBe('Good')
  })

  it('Good: loss exactly 5', () => {
    expect(classifyMove(5, false)).toBe('Good')
  })

  it('Inaccuracy: loss just above 5', () => {
    expect(classifyMove(5.001, false)).toBe('Inaccuracy')
  })

  it('Inaccuracy: loss exactly 10', () => {
    expect(classifyMove(10, false)).toBe('Inaccuracy')
  })

  it('Mistake: loss just above 10', () => {
    expect(classifyMove(10.001, false)).toBe('Mistake')
  })

  it('Mistake: loss exactly 20', () => {
    expect(classifyMove(20, false)).toBe('Mistake')
  })

  it('Blunder: loss just above 20', () => {
    expect(classifyMove(20.001, false)).toBe('Blunder')
  })

  it('Blunder: large loss', () => {
    expect(classifyMove(100, false)).toBe('Blunder')
  })
})

describe('isSacrifice', () => {
  it('capture worth less than the mover → sacrifice', () => {
    // queen (9) captures a knight (3)
    const move = { piece: 'q', captured: 'n', color: 'w', to: 'e4', after: 'x' } as unknown as Move
    expect(isSacrifice(move)).toBe(true)
  })

  it('capture worth more than or equal to the mover → not a sacrifice', () => {
    // knight (3) captures a queen (9)
    const move = { piece: 'n', captured: 'q', color: 'w', to: 'e4', after: 'x' } as unknown as Move
    expect(isSacrifice(move)).toBe(false)
  })

  it('pawn non-capture is never a sacrifice', () => {
    const move = { piece: 'p', captured: undefined, color: 'w', to: 'e4', after: 'x' } as unknown as Move
    expect(isSacrifice(move)).toBe(false)
  })

  it('non-capture onto a square defended by the mover\'s own side → not a sacrifice (regression: defended outpost)', () => {
    // Sveshnikov Sicilian: 9.Nd5 lands the knight on a square attacked by ...Nf6
    // but defended by White's own e4 pawn — a normal supported move, not a sacrifice.
    const chess = new Chess()
    for (const san of ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5', 'Ndb5', 'd6', 'Bg5', 'a6', 'Na3', 'b5']) {
      chess.move(san)
    }
    const move = chess.move('Nd5')
    expect(isSacrifice(move)).toBe(false)
  })

  it('non-capture onto a square genuinely undefended → still a sacrifice', () => {
    // White Nc3-d5: attacked by Black's e6 pawn, no White piece defends d5.
    const chess = new Chess('4k3/8/4p3/8/8/2N5/8/4K3 w - - 0 1')
    const move = chess.move({ from: 'c3', to: 'd5' })
    expect(isSacrifice(move)).toBe(true)
  })
})

describe('classifyMove — Brilliant', () => {
  it('fires: sacrifice, small loss, not trivially won, not lost afterward', () => {
    // winPctBefore=67.62 (cp=200), loss=1 → winPctAfter=66.62 (>=50)
    expect(classifyMove(1, false, sacMv('Qxh7'), 67.6212, null, null)).toBe('Brilliant')
  })

  it('blocked: sacrifice played from a position that stays lost afterward', () => {
    // winPctBefore=24.89 (cp=-300), loss=1 → winPctAfter=23.89 (<50) — still losing
    expect(classifyMove(1, false, sacMv('Qxh7'), 24.8874, null, null)).not.toBe('Brilliant')
    expect(classifyMove(1, false, sacMv('Qxh7'), 24.8874, null, null)).toBe('Excellent')
  })

  it('blocked: position already trivially won (winPctBefore >= 90)', () => {
    // winPctBefore=92.94 (cp=700), loss=1
    expect(classifyMove(1, false, sacMv('Qxh7'), 92.9397, null, null)).not.toBe('Brilliant')
  })

  it('blocked: loss too big (> 2)', () => {
    expect(classifyMove(3, false, sacMv('Qxh7'), 67.6212, null, null)).not.toBe('Brilliant')
  })

  it('blocked: move is not a sacrifice', () => {
    const notASac = mv('Nf3')
    expect(classifyMove(1, false, notASac, 67.6212, null, null)).not.toBe('Brilliant')
  })
})

describe('classifyMove — Great', () => {
  it('fires: best move keeps the game fine, 2nd-best loses it (critical position)', () => {
    // bestCp=200 → winPctBefore=67.62 (<85); secondBestCp=-400 → winPct=18.65 (<50); gap≈48.97
    expect(classifyMove(0, true, undefined, 67.6212, 200, -400)).toBe('Great')
  })

  it('blocked: big gap but 2nd-best is still favored to win (key regression)', () => {
    // bestCp=450 → winPctBefore=83.98 (<85); secondBestCp=20 → winPct=51.84 (NOT <50); gap≈32.14 (passes gap alone)
    expect(classifyMove(0, true, undefined, 83.9826, 450, 20)).not.toBe('Great')
  })

  it('blocked: ordinary recapture-style gap that would have wrongly fired under the old >=10 threshold', () => {
    // bestCp=300, secondBestCp=100 → gap≈16.01
    expect(classifyMove(0, true, undefined, 75.1126, 300, 100)).not.toBe('Great')
  })

  it('fires: 2nd-best alternative is forced mate', () => {
    // bestCp=50 → winPctBefore=54.59 (<85); secondBestCp=-10000 (mate sentinel) → winPct≈0; gap≈54.59
    expect(classifyMove(0, true, undefined, 54.5896, 50, -10000)).toBe('Great')
  })

  it('blocked: not the engine\'s best move', () => {
    expect(classifyMove(0, false, undefined, 67.6212, 200, -400)).not.toBe('Great')
  })

  it('blocked: position already comfortably winning (winPctBefore >= 85)', () => {
    // bestCp=900 → winPctBefore=96.49 (>=85)
    expect(classifyMove(0, true, undefined, 96.4902, 900, -400)).not.toBe('Great')
  })

  it('blocked: secondBestCp is null (no throw, no false positive)', () => {
    expect(classifyMove(0, true, undefined, 67.6212, 200, null)).not.toBe('Great')
  })
})

describe('buildMoveAnalyses — Vorzeichen-Logik', () => {
  it('white blunder: cp drops from 0 to -500 → Blunder', () => {
    const [a] = buildMoveAnalyses([mv('d4')], [ev(0), ev(-500)])
    expect(a.classification).toBe('Blunder')
    expect(a.lossInWinPct).toBeGreaterThan(20)
  })

  it('white improvement: cp rises 0→+200 → 0 loss (clamped)', () => {
    const [a] = buildMoveAnalyses([mv('Nxf7')], [ev(0), ev(200)])
    expect(a.lossInWinPct).toBe(0)
    expect(a.classification).toBe('Excellent')
  })

  it('black good move: cp drops in white-perspective (200→100) → 0 loss', () => {
    // evalResults: [before-white, after-white/before-black, after-black]
    // Black plays at index 1; cp goes 200→100 (white advantage shrinks = black improved)
    // Correct: from black perspective cpBefore=-200, cpAfter=-100 → winPct improved → loss=0
    // Bug (no negation): 200→100 would give loss≈8.5 → Inaccuracy (WRONG)
    const moves = [mv('e4'), mv('Nc6')]
    const evals = [ev(0), ev(200), ev(100)]
    const analyses = buildMoveAnalyses(moves, evals)
    const blackMove = analyses.find(a => a.moveIndex === 1)!
    expect(blackMove.lossInWinPct).toBe(0)
    expect(blackMove.classification).toBe('Excellent')
  })

  it('black blunder: cp rises in white-perspective (0→+500) → Blunder', () => {
    // Black plays at index 1; after black's move white has +500 → black blundered
    const moves = [mv('e4'), mv('Nd4??')]
    const evals = [ev(0), ev(0), ev(500)]
    const analyses = buildMoveAnalyses(moves, evals)
    const blackMove = analyses.find(a => a.moveIndex === 1)!
    // From black: cpBefore=0 → winPct=50, cpAfter=-500 → winPct≈10 → loss≈40 → Blunder
    expect(blackMove.classification).toBe('Blunder')
    expect(blackMove.lossInWinPct).toBeGreaterThan(20)
  })

  it('loss is clamped to 0 — never negative', () => {
    // White gains material: eval goes from 0 to +400 → would give negative loss without clamp
    const [a] = buildMoveAnalyses([mv('Rxf7')], [ev(0), ev(400)])
    expect(a.lossInWinPct).toBe(0)
  })

  it('isEngineBestMove: san === bestMoveSan → Best', () => {
    const [a] = buildMoveAnalyses([mv('e4')], [ev(0, 'e4'), ev(50)])
    expect(a.classification).toBe('Best')
  })

  it('isEngineBestMove: san !== bestMoveSan → not Best', () => {
    // -400cp: loss = winPct(0)-winPct(-400) ≈ 50-18.6 = 31.4 → Blunder
    const [a] = buildMoveAnalyses([mv('d4')], [ev(0, 'e4'), ev(-400)])
    expect(a.classification).not.toBe('Best')
    expect(a.classification).toBe('Blunder')
  })

  it('skips positions where evalResults entry is null', () => {
    const analyses = buildMoveAnalyses([mv('e4')], [ev(0), null])
    expect(analyses).toHaveLength(0)
  })

  it('mate score treated as ±10000 cp', () => {
    // White announces mate: evalBefore has mate=2 (white mates in 2), evalAfter also mate=1
    const mateEv = (mateIn: number): EvalResult => ({ cp: null, mate: mateIn, bestMoveSan: null, pv: null, secondBestCp: null })
    const [a] = buildMoveAnalyses([mv('Qh5+')], [mateEv(2), mateEv(1)])
    // Both map to +10000 from white's perspective → loss ≈ 0
    expect(a.lossInWinPct).toBe(0)
  })

  it('accuracy field is populated on each MoveAnalysis', () => {
    const [a] = buildMoveAnalyses([mv('e4')], [ev(0), ev(0)])
    expect(a.accuracy).toBeGreaterThanOrEqual(0)
    expect(a.accuracy).toBeLessThanOrEqual(100)
  })
})

describe('buildMoveAnalyses — Brilliant/Great end-to-end', () => {
  it('sacrifice played from a losing position is NOT Brilliant, even with tiny loss', () => {
    // cpBefore=-300 (winPct≈24.89), cpAfter=-320 (winPct≈23.54) → loss≈1.35, still losing after
    const [a] = buildMoveAnalyses([sacMv('Qxh7')], [ev(-300), ev(-320)])
    expect(a.classification).not.toBe('Brilliant')
    expect(a.classification).toBe('Excellent')
  })

  it('sacrifice played while staying afloat IS Brilliant', () => {
    // cpBefore=200 (winPct≈67.62), cpAfter=180 (winPct≈65.99) → loss≈1.63, still >=50 after
    const [a] = buildMoveAnalyses([sacMv('Qxh7')], [ev(200), ev(180)])
    expect(a.classification).toBe('Brilliant')
  })

  it('Great fires end-to-end via secondBestCp on the EvalResult', () => {
    // bestCp=200 (winPctBefore≈67.62<85), secondBestCp=-400 (winPct≈18.65<50) → gap≈48.97
    const [a] = buildMoveAnalyses([mv('Nf3')], [ev(200, 'Nf3', -400), ev(180)])
    expect(a.classification).toBe('Great')
  })
})

describe('moveAccuracy', () => {
  it('returns ~100 at loss=0 (perfect move)', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 0)
  })

  it('is clamped to max 100', () => {
    expect(moveAccuracy(0)).toBeLessThanOrEqual(100)
  })

  it('returns ~79.8 at loss=5', () => {
    expect(moveAccuracy(5)).toBeCloseTo(79.8, 0)
  })

  it('returns ~63.6 at loss=10', () => {
    expect(moveAccuracy(10)).toBeCloseTo(63.6, 0)
  })

  it('returns ~40.0 at loss=20', () => {
    expect(moveAccuracy(20)).toBeCloseTo(40.0, 0)
  })

  it('is clamped to 0 for very large loss', () => {
    expect(moveAccuracy(100)).toBe(0)
  })

  it('is monotonically decreasing: loss=5 > loss=20', () => {
    expect(moveAccuracy(5)).toBeGreaterThan(moveAccuracy(20))
  })
})

describe('buildMoveAnalyses — Book classification', () => {
  it('marks moves below openingPly as Book', () => {
    const moves = [mv('e4'), mv('e5'), mv('Nf3')]
    const evals = [ev(0), ev(0), ev(0), ev(0)]
    const analyses = buildMoveAnalyses(moves, evals, 2)
    expect(analyses[0].classification).toBe('Book')
    expect(analyses[1].classification).toBe('Book')
    expect(analyses[2].classification).not.toBe('Book')
  })

  it('Book moves have lossInWinPct=0 and accuracy=100', () => {
    const analyses = buildMoveAnalyses([mv('e4'), mv('e5')], [ev(0), ev(0), ev(0)], 2)
    for (const a of analyses) {
      expect(a.lossInWinPct).toBe(0)
      expect(a.accuracy).toBe(100)
    }
  })

  it('openingPly=0 means no Book moves', () => {
    const analyses = buildMoveAnalyses([mv('e4')], [ev(0), ev(0)], 0)
    expect(analyses[0].classification).not.toBe('Book')
  })
})

describe('playerAccuracy', () => {
  it('returns null when analyses is empty', () => {
    expect(playerAccuracy([], 'white')).toBeNull()
    expect(playerAccuracy([], 'black')).toBeNull()
  })

  it('returns null when no moves for that player', () => {
    // Only one move at index 0 (white) — black has no moves
    const analyses = buildMoveAnalyses([mv('e4')], [ev(0), ev(0)])
    expect(playerAccuracy(analyses, 'black')).toBeNull()
  })

  it('returns white accuracy from even-index moves only', () => {
    const moves = [mv('e4'), mv('e5'), mv('Nf3')]
    const evals = [ev(0), ev(0), ev(0), ev(0)]
    const analyses = buildMoveAnalyses(moves, evals)
    const white = playerAccuracy(analyses, 'white')!
    expect(white).toBeGreaterThan(0)
    expect(white).toBeLessThanOrEqual(100)
    // White has 2 moves (index 0 and 2), both loss=0 → accuracy ≈ 100
    expect(white).toBeCloseTo(100, 0)
  })

  it('returns average accuracy for black (odd-index moves)', () => {
    const moves = [mv('e4'), mv('e5')]
    const evals = [ev(0), ev(0), ev(0)]
    const analyses = buildMoveAnalyses(moves, evals)
    const black = playerAccuracy(analyses, 'black')!
    expect(black).toBeGreaterThan(0)
    expect(black).toBeLessThanOrEqual(100)
  })

  it('lower accuracy when player blunders', () => {
    // White plays a blunder: cp drops from 0 to -500
    const analyses = buildMoveAnalyses([mv('d4')], [ev(0), ev(-500)])
    const white = playerAccuracy(analyses, 'white')!
    expect(white).toBeLessThan(50)
  })

  it('Book moves are excluded from accuracy calculation', () => {
    // 2 Book moves (white+black), then 1 non-Book move for white
    const moves = [mv('e4'), mv('e5'), mv('Nf3')]
    const evals = [ev(0), ev(0), ev(0), ev(0)]
    const analyses = buildMoveAnalyses(moves, evals, 2)
    // moves[0] (white, Book) excluded; moves[2] (white) included with loss=0 → ~100
    const white = playerAccuracy(analyses, 'white')!
    expect(white).toBeCloseTo(100, 0)
  })

  it('returns null when all player moves are Book', () => {
    // 2 moves both Book (openingPly=2); white has no non-Book moves
    const analyses = buildMoveAnalyses([mv('e4'), mv('e5')], [ev(0), ev(0), ev(0)], 2)
    expect(playerAccuracy(analyses, 'white')).toBeNull()
    expect(playerAccuracy(analyses, 'black')).toBeNull()
  })
})

describe('findKeyMoments', () => {
  function makeAnalyses(losses: number[]): MoveAnalysis[] {
    return losses.map((loss, i) => ({
      moveIndex: i,
      lossInWinPct: loss,
      classification: classifyMove(loss, false),
      accuracy: 100 - loss,
    }))
  }

  it('returns top-N move indices by lossInWinPct', () => {
    const analyses = makeAnalyses([5, 25, 3, 30, 10])
    const km = findKeyMoments(analyses, 3)
    expect(km.has(3)).toBe(true)  // loss=30 — highest
    expect(km.has(1)).toBe(true)  // loss=25 — second
    expect(km.has(4)).toBe(true)  // loss=10 — third
    expect(km.has(0)).toBe(false)
    expect(km.has(2)).toBe(false)
  })

  it('returns all when n >= analyses.length', () => {
    const analyses = makeAnalyses([5, 25, 3])
    const km = findKeyMoments(analyses, 10)
    expect(km.size).toBe(3)
  })

  it('excludes Book moves', () => {
    const analyses: MoveAnalysis[] = [
      { moveIndex: 0, lossInWinPct: 0, classification: 'Book', accuracy: 100 },
      { moveIndex: 1, lossInWinPct: 0, classification: 'Book', accuracy: 100 },
      { moveIndex: 2, lossInWinPct: 30, classification: 'Blunder', accuracy: 0 },
    ]
    const km = findKeyMoments(analyses, 3)
    expect(km.has(0)).toBe(false)
    expect(km.has(1)).toBe(false)
    expect(km.has(2)).toBe(true)
  })

  it('returns empty set for empty input', () => {
    expect(findKeyMoments([], 5).size).toBe(0)
  })
})
