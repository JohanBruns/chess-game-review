import type { EvalResult } from '../engine/useEngine'
import type { MoveAnalysis, MoveClass } from './classify'

export interface Puzzle {
  // 0-based index into moves/fens/moveAnalyses of the mistake this puzzle is built from.
  moveIndex: number
  // Position the puzzle starts from (fens[moveIndex]) — the position BEFORE the mistake, the
  // one the solver has to find the right move in.
  fenBefore: string
  // The engine's single best move from fenBefore (the puzzle's solution).
  bestSan: string
  // What was actually played in the game (the mistake being drilled).
  playedSan: string
  classification: MoveClass
}

// Only genuine mistakes make good "learn from your errors" puzzles — a Best/Book/Great move has
// nothing to drill, and an Inaccuracy is usually too subtle for a single-move tactic.
export const PUZZLE_CLASSES: ReadonlySet<MoveClass> = new Set<MoveClass>(['Mistake', 'Miss', 'Blunder'])

// Minimum centipawn gap between the engine's best and second-best move for a position to be a
// puzzle. A large gap means the solution is UNIQUE (only one move works), so a solver who finds
// it deserves credit — a small gap means several moves are roughly as good and requiring the exact
// SAN would be unfair. One pawn is a deliberately conservative bar.
export const PUZZLE_GAP_MIN = 100

// Extracts single-move tactic puzzles from an analysed game: every Mistake/Miss/Blunder ply whose
// position has a clearly-best reply (best vs. second-best gap >= gapMinCp). Returned in game order;
// each puzzle drills the position BEFORE the mistake. Pure — no engine calls at solve time, since
// the solution (bestSan) is already known from the batch analysis.
export function extractPuzzles(
  moves: { san: string }[],
  fens: string[],
  evalResults: (EvalResult | null)[],
  moveAnalyses: MoveAnalysis[],
  options?: { gapMinCp?: number; classes?: ReadonlySet<MoveClass> },
): Puzzle[] {
  const gapMinCp = options?.gapMinCp ?? PUZZLE_GAP_MIN
  const classes = options?.classes ?? PUZZLE_CLASSES
  const puzzles: Puzzle[] = []

  for (const analysis of moveAnalyses) {
    const i = analysis.moveIndex
    if (!classes.has(analysis.classification)) continue

    // Eval of the position BEFORE the move (fens[i]) carries that position's best/second-best.
    const ev = evalResults[i]
    const fenBefore = fens[i]
    const playedSan = moves[i]?.san
    if (!ev || fenBefore == null || playedSan == null) continue

    const bestSan = ev.bestMoveSan
    // No engine reference, or the "mistake" already coincides with the best move (nothing to
    // solve) — skip. A real Mistake/Blunder never equals best, but guard anyway.
    if (bestSan == null || bestSan === playedSan) continue

    // Uniqueness gate: both cp values are White-absolute, but the engine orders MultiPV by the
    // mover's preference, so |best - second| is the gap regardless of side to move.
    if (ev.cp == null || ev.secondBestCp == null) continue
    if (Math.abs(ev.cp - ev.secondBestCp) < gapMinCp) continue

    puzzles.push({ moveIndex: i, fenBefore, bestSan, playedSan, classification: analysis.classification })
  }

  return puzzles
}
