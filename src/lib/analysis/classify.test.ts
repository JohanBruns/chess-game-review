import { describe, it, expect } from 'vitest'
import type { Move } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'
import { winPct, classifyMove, buildMoveAnalyses, moveAccuracy, playerAccuracy, findKeyMoments } from './classify'
import type { MoveAnalysis } from './classify'

// Minimal helpers — buildMoveAnalyses only reads .san from Move and .cp/.mate/.bestMoveSan from EvalResult
const mv = (san: string) => ({ san } as unknown as Move)
const ev = (cp: number, bestMoveSan: string | null = null): EvalResult => ({
  cp,
  mate: null,
  bestMoveSan,
})

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
    const mateEv = (mateIn: number): EvalResult => ({ cp: null, mate: mateIn, bestMoveSan: null })
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
