import type { Move } from 'chess.js'
// Relative imports carry their .ts extension here: Node loads this module directly too
// (scripts/captureParityFixtures.ts), without a bundler to resolve them.
import type { EvalResult } from '../engine/uci.ts'
import { probeSecondLine } from './classify.ts'
import { PUZZLE_CLASSES } from './puzzles.ts'

// The positions (indices into fens; position i is the one before move i) whose second-best
// line the review reads, decided from the first analysis pass — see engine/twoPass.ts. That is:
//   - plies whose class can depend on it (Brilliant's "winning anyway" gate, Great's gap to
//     the second-best line), as reported by the classification itself, and
//   - Mistake/Miss/Blunder plies, whose positions become puzzles only when the best move is
//     clearly better than the second-best (puzzles.ts).
// For every other position a second line changes neither the classes nor the puzzles — which
// is also why the engine-lines panel may add one later without the review shifting.
export function secondLineCandidates(
  moves: Move[],
  firstPass: (EvalResult | null)[],
  whiteRating?: number,
  blackRating?: number,
): number[] {
  const { analyses, sensitivePlies } = probeSecondLine(moves, firstPass, whiteRating, blackRating)
  for (const analysis of analyses) {
    if (PUZZLE_CLASSES.has(analysis.classification)) sensitivePlies.add(analysis.moveIndex)
  }
  return [...sensitivePlies].sort((a, b) => a - b)
}
