import { describe, it, expect } from 'vitest'
import { Chess, type Move } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'
import { winPct, classifyMove, isSacrifice, buildMoveAnalyses, moveAccuracy, playerAccuracy, phaseAccuracy, findKeyMoments } from './classify'
import type { MoveAnalysis, MoveClass } from './classify'

// Minimal helpers — buildMoveAnalyses only reads .san from Move and .cp/.mate/.bestMoveSan from EvalResult
const mv = (san: string) => ({ san } as unknown as Move)

// A fake move carrying only .after (the post-move FEN) — enough to drive buildMoveAnalyses'
// phase detection (nonPawnMaterial reads the FEN's piece-placement field) without needing a
// real, legal move sequence. isForcedMove/isSacrifice both bail out safely on the missing
// .before/.piece fields, so classification falls through to the normal eval-based path.
const mvAfter = (san: string, after: string) => ({ san, after } as unknown as Move)
const HIGH_MATERIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' // 62 non-pawn
const LOW_MATERIAL_FEN = '4k3/8/8/8/8/8/8/4K3 w - - 0 1'                           // 0 non-pawn
const ev = (cp: number, bestMoveSan: string | null = null, secondBestCp: number | null = null): EvalResult => ({
  cp,
  mate: null,
  bestMoveSan,
  pv: null,
  secondBestCp,
  secondBestMoveSan: null,
  thirdBestCp: null,
  thirdBestMoveSan: null,
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

  it('blocked: a MORE valuable own piece hangs free at the same time (hasCostlierHangingPiece veto)', () => {
    // Rxc6 (rook takes knight, PIECE_VAL[n]=3 < PIECE_VAL[r]=5 -> isSacrifice true).
    // After the move, White's queen on d5 is undefended and attacked by the black
    // bishop on f7 (f7-e6-d5 diagonal) — a piece MORE valuable (9) than the rook (5)
    // just committed. This is a blunder that happens to also be a sacrifice, not a
    // brilliancy.
    const chess = new Chess('6k1/5b2/2n5/3Q4/8/8/8/2R3K1 w - - 0 1')
    const move = chess.move({ from: 'c1', to: 'c6' })
    expect(isSacrifice(move)).toBe(true)
    expect(classifyMove(1, false, move, 67.6212, null, null)).not.toBe('Brilliant')
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

describe('classifyMove — rating-aware Brilliant/Great thresholds', () => {
  it('lenient (<1600) loosens the Brilliant loss gate', () => {
    // loss=2.5 is between the neutral max (2) and the lenient max (3).
    expect(classifyMove(2.5, false, sacMv('Qxh7'), 67.6212, null, null, undefined, undefined)).not.toBe('Brilliant')
    expect(classifyMove(2.5, false, sacMv('Qxh7'), 67.6212, null, null, undefined, undefined, 1400)).toBe('Brilliant')
    // A rating inside the neutral band (1600-2000) behaves exactly like no rating at all.
    expect(classifyMove(2.5, false, sacMv('Qxh7'), 67.6212, null, null, undefined, undefined, 1800)).not.toBe('Brilliant')
  })

  it('strict (>2000) tightens the Brilliant loss gate', () => {
    // loss=1.5 is between the strict max (1) and the neutral max (2).
    expect(classifyMove(1.5, false, sacMv('Qxh7'), 67.6212, null, null, undefined, undefined)).toBe('Brilliant')
    expect(classifyMove(1.5, false, sacMv('Qxh7'), 67.6212, null, null, undefined, undefined, 2200)).not.toBe('Brilliant')
  })

  it('lenient (<1600) loosens the Great "only good move" gap requirement', () => {
    // bestCp=300 (winPct≈75.11), secondBestCp=-20 (winPct≈48.16) → gap≈26.95:
    // below the neutral min (30), but above the lenient min (25).
    expect(classifyMove(0, true, undefined, 75.1126, 300, -20)).not.toBe('Great')
    expect(classifyMove(0, true, undefined, 75.1126, 300, -20, undefined, undefined, 1400)).toBe('Great')
  })

  it('lenient (<1600) loosens the Great swing branches\' near-best tolerance', () => {
    // loss=2.0 is between the neutral max (1.5) and the lenient max (2.5).
    expect(classifyMove(2.0, false, undefined, 40, null, null, undefined, 52)).not.toBe('Great')
    expect(classifyMove(2.0, false, undefined, 40, null, null, undefined, 52, 1400)).toBe('Great')
  })

  it('strict (>2000) tightens the Great swing branches\' near-best tolerance', () => {
    // loss=1.2 is between the strict max (1.0) and the neutral max (1.5).
    expect(classifyMove(1.2, false, undefined, 40, null, null, undefined, 52)).toBe('Great')
    expect(classifyMove(1.2, false, undefined, 40, null, null, undefined, 52, 2200)).not.toBe('Great')
  })

  it('tier boundaries are inclusive of neutral: exactly 1600 and exactly 2000 behave as no rating', () => {
    // 1600 must NOT get lenient treatment (loss=2.5 stays blocked, same as the lenient test above).
    expect(classifyMove(2.5, false, sacMv('Qxh7'), 67.6212, null, null, undefined, undefined, 1600)).not.toBe('Brilliant')
    // 2000 must NOT get strict treatment (loss=1.5 stays Brilliant, same as the strict test above).
    expect(classifyMove(1.5, false, sacMv('Qxh7'), 67.6212, null, null, undefined, undefined, 2000)).toBe('Brilliant')
  })
})

describe('classifyMove — Great swing branches', () => {
  it('fires: lost -> equal via a near-best move (winPctAfterRaw, not the loss-derived reconstruction)', () => {
    // winPctBefore=40 (lost), loss=1 (near-best, isNearBest), winPctAfterRaw=52 (equal) —
    // only reachable via the explicit winPctAfterRaw param, since winPctBefore - loss = 39
    // could never reach 52 (that's exactly the bug this param fixes).
    expect(classifyMove(1, false, undefined, 40, null, null, undefined, 52)).toBe('Great')
  })

  it('fires: equal -> winning via a near-best move', () => {
    expect(classifyMove(1, false, undefined, 52, null, null, undefined, 78)).toBe('Great')
  })

  it('blocked: near-best but no swing (still comfortably winning either way)', () => {
    // winPctBefore=70 doesn't qualify for either swing bracket (<50 or <=55)
    expect(classifyMove(1, false, undefined, 70, null, null, undefined, 71)).not.toBe('Great')
  })

  it('blocked: swing-shaped values but loss too big (not near-best)', () => {
    expect(classifyMove(5, false, undefined, 40, null, null, undefined, 52)).not.toBe('Great')
  })

  it('blocked: winPctAfterRaw omitted — swing branch does not fire (safe default)', () => {
    expect(classifyMove(1, false, undefined, 40, null, null)).not.toBe('Great')
  })
})

describe('classifyMove — Miss', () => {
  it('fires: opponent handed you a win (winPctPrior<80), you let it slip to equal/worse', () => {
    // winPctBefore=85, loss=35 → winPctAfter=50 (<=55); winPctPrior=60 (<80)
    expect(classifyMove(35, false, undefined, 85, null, null, 60)).toBe('Miss')
  })

  it('blocked: was already winning big before the opponent\'s move (winPctPrior>=80)', () => {
    // Same before/after as the firing case, but winPctPrior=90 → not a freshly created win
    expect(classifyMove(35, false, undefined, 85, null, null, 90)).not.toBe('Miss')
    expect(classifyMove(35, false, undefined, 85, null, null, 90)).toBe('Blunder')
  })

  it('blocked: result didn\'t drop far enough (winPctAfter above the ceiling)', () => {
    // winPctBefore=85, loss=15 → winPctAfter=70 (>55, not "let slip")
    expect(classifyMove(15, false, undefined, 85, null, null, 60)).not.toBe('Miss')
    expect(classifyMove(15, false, undefined, 85, null, null, 60)).toBe('Mistake')
  })

  it('winPctPrior omitted (undefined) still fires on the two core conditions', () => {
    expect(classifyMove(35, false, undefined, 85, null, null)).toBe('Miss')
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
    const mateEv = (mateIn: number): EvalResult => ({ cp: null, mate: mateIn, bestMoveSan: null, pv: null, secondBestCp: null, secondBestMoveSan: null, thirdBestCp: null, thirdBestMoveSan: null })
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

  it('rating-aware: whiteRating/blackRating are threaded through per-mover, not swapped', () => {
    // cpBefore=200 (winPct≈67.62), cpAfter=165 (winPct≈64.74) → loss≈2.88 for White's sac —
    // too big for neutral (max 2) but within the lenient band (max 3, whiteRating < 1600).
    const moves = [sacMv('Qxh7')]
    const evals = [ev(200), ev(165)]

    const [noRating] = buildMoveAnalyses(moves, evals)
    expect(noRating.classification).not.toBe('Brilliant')

    // blackRating=2200 (strict) must have no effect on White's move — only whiteRating matters here.
    const [whiteLenient] = buildMoveAnalyses(moves, evals, 0, 1400, 2200)
    expect(whiteLenient.classification).toBe('Brilliant')
  })
})

describe('buildMoveAnalyses — Miss end-to-end', () => {
  it('opponent blunder creates a fresh win that the mover then lets slip → Miss, not Blunder', () => {
    // m0 (white, arbitrary) → m1 (black blunders: white's cp jumps 100→470, winPct≈59→85,
    // i.e. a fresh win appears) → m2 (white fails to convert: cp drops back to 50, winPct≈55).
    // Without the winPctPrior guard this would just be a 30-point-loss Blunder.
    const moves = [mv('Nf3'), mv('Bad??'), mv('Meh')]
    const evals = [ev(0), ev(100), ev(470), ev(50)]
    const analyses = buildMoveAnalyses(moves, evals)
    const whiteMove = analyses.find(a => a.moveIndex === 2)!
    expect(whiteMove.classification).toBe('Miss')
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

describe('buildMoveAnalyses — Forced classification', () => {
  it('marks the only legal move in a position as Forced', () => {
    // king + rook vs. lone king, black to move — Ka7 is the only legal move
    const [onlyMove] = new Chess('k7/8/8/8/8/8/8/1R5K b - - 0 1').moves({ verbose: true })
    const analyses = buildMoveAnalyses([onlyMove], [ev(0), ev(0)])
    expect(analyses[0].classification).toBe('Forced')
    expect(analyses[0].accuracy).toBe(100)
    expect(analyses[0].lossInWinPct).toBe(0)
  })

  it('a normal move with multiple legal alternatives is not Forced', () => {
    const analyses = buildMoveAnalyses([mv('e4')], [ev(0), ev(0)])
    expect(analyses[0].classification).not.toBe('Forced')
  })
})

describe('buildMoveAnalyses — phase', () => {
  it('opening phase extends to at least ply 20 even when openingPly (book match) is shorter', () => {
    // openingPly=2 (book match ends early), but material stays high throughout — the opening
    // phase must still cover plies 0..19 (OPENING_MIN_PLIES), not just the 2 book plies.
    const moves = Array.from({ length: 25 }, () => mvAfter('Nf3', HIGH_MATERIAL_FEN))
    const evals = Array.from({ length: 26 }, () => ev(0))
    const analyses = buildMoveAnalyses(moves, evals, 2)
    expect(analyses[19].phase).toBe('opening')
    expect(analyses[20].phase).toBe('middlegame')
  })

  it('switches to endgame once non-pawn material drops at/below the threshold, and stays there', () => {
    const moves = [
      ...Array.from({ length: 20 }, () => mvAfter('Nf3', HIGH_MATERIAL_FEN)), // plies 0-19
      mvAfter('Qxd8', LOW_MATERIAL_FEN),  // ply 20: material collapses here
      mvAfter('Kxd8', LOW_MATERIAL_FEN),  // ply 21: stays endgame (sticky)
    ]
    const evals = Array.from({ length: 23 }, () => ev(0))
    const analyses = buildMoveAnalyses(moves, evals, 0)
    expect(analyses[19].phase).toBe('opening')  // still within OPENING_MIN_PLIES
    expect(analyses[20].phase).toBe('endgame')
    expect(analyses[21].phase).toBe('endgame')
  })

  it('Book and Forced moves still get a phase assigned', () => {
    const moves = [mv('e4'), mv('e5')]
    const evals = [ev(0), ev(0), ev(0)]
    const analyses = buildMoveAnalyses(moves, evals, 2)
    expect(analyses[0].classification).toBe('Book')
    expect(analyses[0].phase).toBe('opening')
    expect(analyses[1].phase).toBe('opening')
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

  it('Forced moves are excluded from accuracy calculation', () => {
    // White: one Forced move (accuracy 100, would skew toward 100) + one Blunder (accuracy 10).
    // If Forced were included, the mean would be ~55; excluded, it must equal the Blunder alone.
    const analyses: MoveAnalysis[] = [
      { moveIndex: 0, lossInWinPct: 0, classification: 'Forced', accuracy: 100 },
      { moveIndex: 2, lossInWinPct: 30, classification: 'Blunder', accuracy: 10 },
    ]
    expect(playerAccuracy(analyses, 'white')).toBe(10)
  })

  it('scores a big blunder among strong moves below the old arithmetic mean', () => {
    // Equal winPctAfterRaw across all moves → uniform volatility weights → weightedMean
    // equals the old plain arithmetic mean; the harmonic-mean term is what drags the
    // combined score below it (T5 acceptance: punish the outlier instead of averaging it away).
    const analyses: MoveAnalysis[] = [
      { moveIndex: 0, lossInWinPct: 0.1, classification: 'Excellent', accuracy: 99, winPctAfterRaw: 70 },
      { moveIndex: 2, lossInWinPct: 0.1, classification: 'Excellent', accuracy: 99, winPctAfterRaw: 70 },
      { moveIndex: 4, lossInWinPct: 30, classification: 'Blunder', accuracy: 20, winPctAfterRaw: 70 },
      { moveIndex: 6, lossInWinPct: 0.1, classification: 'Excellent', accuracy: 99, winPctAfterRaw: 70 },
    ]
    const oldArithmeticMean = (99 + 99 + 20 + 99) / 4 // 79.25
    const acc = playerAccuracy(analyses, 'white')!
    expect(acc).toBeLessThan(oldArithmeticMean)
    expect(acc).toBeCloseTo(64.5, 0)
  })

  it('weights a blunder in a volatile position more heavily than in a calm one', () => {
    // White moves: index 0 (acc 100) and index 6 (acc 40). Odd indices are black fillers
    // (auto-excluded from white) used only to shape the win% trajectory around index 6.
    // winPctAfterRaw is MOVER-perspective, so an odd (black) index storing X yields a
    // White-perspective trajectory value of 100-X.
    const base = (
      moveIndex: number, accuracy: number, cls: MoveClass, winPctAfterRaw: number,
    ): MoveAnalysis => ({ moveIndex, lossInWinPct: 0, classification: cls, accuracy, winPctAfterRaw })

    // Calm: white-perspective trajectory is flat (50) around index 6 → weight floors at 0.5.
    const calm: MoveAnalysis[] = [
      base(0, 100, 'Best', 50), base(1, 0, 'Good', 50),
      base(5, 0, 'Good', 50), base(6, 40, 'Blunder', 50), base(7, 0, 'Good', 50),
    ]
    // Volatile: white-perspective trajectory swings 80/50/20 around index 6 → high std-dev.
    const volatile: MoveAnalysis[] = [
      base(0, 100, 'Best', 50), base(1, 0, 'Good', 50),
      base(5, 0, 'Good', 80), base(6, 40, 'Blunder', 50), base(7, 0, 'Good', 20),
    ]
    expect(playerAccuracy(volatile, 'white')!).toBeLessThan(playerAccuracy(calm, 'white')!)
  })
})

describe('phaseAccuracy', () => {
  it('returns null for every phase when analyses is empty', () => {
    expect(phaseAccuracy([], 'white')).toEqual({ opening: null, middlegame: null, endgame: null })
  })

  it('returns null for a phase with no qualifying moves (e.g. a game with no endgame)', () => {
    const analyses: MoveAnalysis[] = [
      { moveIndex: 0, lossInWinPct: 0, classification: 'Best', accuracy: 100, phase: 'opening' },
      { moveIndex: 2, lossInWinPct: 5, classification: 'Good', accuracy: 90, phase: 'middlegame' },
    ]
    const result = phaseAccuracy(analyses, 'white')
    expect(result.opening).not.toBeNull()
    expect(result.middlegame).not.toBeNull()
    expect(result.endgame).toBeNull()
  })

  it('splits accuracy per phase and ignores the other phases', () => {
    const analyses: MoveAnalysis[] = [
      { moveIndex: 0, lossInWinPct: 0,  classification: 'Best',    accuracy: 100, phase: 'opening' },
      { moveIndex: 2, lossInWinPct: 30, classification: 'Blunder', accuracy: 10,  phase: 'middlegame' },
      { moveIndex: 4, lossInWinPct: 0,  classification: 'Best',    accuracy: 100, phase: 'endgame' },
    ]
    const result = phaseAccuracy(analyses, 'white')
    expect(result.opening).toBeCloseTo(100, 0)
    expect(result.middlegame).toBeCloseTo(10, 0)
    expect(result.endgame).toBeCloseTo(100, 0)
  })

  it('excludes Book/Forced moves within a phase, same as playerAccuracy', () => {
    const analyses: MoveAnalysis[] = [
      { moveIndex: 0, lossInWinPct: 0, classification: 'Book',    accuracy: 100, phase: 'opening' },
      { moveIndex: 2, lossInWinPct: 0, classification: 'Forced',  accuracy: 100, phase: 'opening' },
      { moveIndex: 4, lossInWinPct: 30, classification: 'Blunder', accuracy: 10, phase: 'opening' },
    ]
    // If Book/Forced counted, the mean would sit near (100+100+10)/3 ≈ 70; excluded, it must
    // equal the Blunder's own accuracy.
    expect(phaseAccuracy(analyses, 'white').opening).toBe(10)
  })

  it('agrees with playerAccuracy when every move shares the same phase (consistency check)', () => {
    const analyses: MoveAnalysis[] = [
      { moveIndex: 0, lossInWinPct: 0.1, classification: 'Excellent', accuracy: 99, winPctAfterRaw: 70, phase: 'middlegame' },
      { moveIndex: 2, lossInWinPct: 0.1, classification: 'Excellent', accuracy: 99, winPctAfterRaw: 70, phase: 'middlegame' },
      { moveIndex: 4, lossInWinPct: 30,  classification: 'Blunder',   accuracy: 20, winPctAfterRaw: 70, phase: 'middlegame' },
      { moveIndex: 6, lossInWinPct: 0.1, classification: 'Excellent', accuracy: 99, winPctAfterRaw: 70, phase: 'middlegame' },
    ]
    const overall = playerAccuracy(analyses, 'white')!
    const middlegame = phaseAccuracy(analyses, 'white').middlegame!
    expect(middlegame).toBeCloseTo(overall, 5)
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
