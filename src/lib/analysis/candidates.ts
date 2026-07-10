import type { Move } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'
import { winPct, evalToCp, sacrificeSquares } from './classify'

// Candidate loss threshold, in win%-points. Sits below the 10-point Mistake cutoff on purpose:
// pass-2 refinement shifts evals slightly, so moves near the Inaccuracy/Mistake boundary must be
// refined too or their final classification would rest on unrefined pass-1 noise.
const LOSS_CANDIDATE_MIN = 8

// Most lenient SEE tier (RatingThresholds.sacrificeSeeMin for <1600 players) so the candidate
// set is a superset of what any rating tier's Brilliant gate could later consider a sacrifice.
const SACRIFICE_SEE_MIN = 2

// Pass-2 selection for the two-pass game analysis (useEngine.analyzeGame): pass 1 evaluates
// every position single-PV on a small time budget; this picks the position indices whose final
// classification actually depends on MultiPV data or is sensitive enough to deserve the deeper
// pass-2 search (MultiPV 3, larger budget). Move i runs from position i to position i+1
// (fens/evalResults are position-indexed, length = moves.length + 1).
//
// A position is a candidate when:
//  - its pass-1 result is missing (search failed) → retry it
//  - the played move matches the engine best → i (the Great gates read secondBestCp of i)
//  - win%-loss > LOSS_CANDIDATE_MIN → i and i+1 (Mistake/Miss/Blunder precision, puzzle gap)
//  - the move is a sacrifice → i and i+1 (Brilliant loss gates + the PV-confirmation reply
//    comes from position i+1's bestMoveSan)
export function selectRefinementCandidates(
  moves: Move[],
  evalResults: (EvalResult | null)[],
): number[] {
  const out = new Set<number>()
  const add = (i: number) => {
    if (i >= 0 && i < evalResults.length) out.add(i)
  }

  for (let i = 0; i < evalResults.length; i++) {
    if (evalResults[i] == null) add(i)
  }

  for (let i = 0; i < moves.length; i++) {
    const before = evalResults[i]
    const after = evalResults[i + 1]

    if (before?.bestMoveSan != null && moves[i].san === before.bestMoveSan) add(i)

    if (before && after) {
      const isWhite = i % 2 === 0
      const cpBefore = isWhite ? evalToCp(before) : -evalToCp(before)
      const cpAfter = isWhite ? evalToCp(after) : -evalToCp(after)
      if (winPct(cpBefore) - winPct(cpAfter) > LOSS_CANDIDATE_MIN) {
        add(i)
        add(i + 1)
      }
    }

    if (sacrificeSquares(moves[i], SACRIFICE_SEE_MIN).length > 0) {
      add(i)
      add(i + 1)
    }
  }

  return [...out].sort((a, b) => a - b)
}
