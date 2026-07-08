import type { MoveAnalysis, MoveClass } from './classify'
import { playerAccuracy, phaseAccuracy } from './classify'
import { estimateGameRating } from './gameRating'

const ALL_CLASSES: MoveClass[] = [
  'Book', 'Brilliant', 'Great', 'Best', 'Excellent', 'Good',
  'Inaccuracy', 'Mistake', 'Blunder', 'Miss', 'Forced',
]

export function classificationCounts(
  analyses: MoveAnalysis[],
  player: 'white' | 'black',
): Record<MoveClass, number> {
  const counts = Object.fromEntries(ALL_CLASSES.map(c => [c, 0])) as Record<MoveClass, number>
  const isPlayerMove = (a: MoveAnalysis) =>
    player === 'white' ? a.moveIndex % 2 === 0 : a.moveIndex % 2 !== 0
  for (const a of analyses) {
    if (isPlayerMove(a)) counts[a.classification]++
  }
  return counts
}

// Live chess.com Game Review (2026-07-08 checkpoint, game 171190174548) renders the
// Opening/Middlegame/Endgame phase rows as a single ICON from the same set used for
// individual move classifications (e.g. a blue "Great" mark for a strong opening) — there is
// no separate phase-grade word or icon set. PhaseGrade values are therefore chosen to be a
// subset of MoveClass so callers can index classIcons/classColors directly with the result.
export type PhaseGrade = 'Great' | 'Excellent' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder'

const PHASE_GRADE_GREAT_MIN = 95
const PHASE_GRADE_EXCELLENT_MIN = 90
const PHASE_GRADE_GOOD_MIN = 75
const PHASE_GRADE_INACCURACY_MIN = 60
const PHASE_GRADE_MISTAKE_MIN = 45

export function phaseGrade(phaseAcc: number | null): PhaseGrade | null {
  if (phaseAcc == null) return null
  if (phaseAcc >= PHASE_GRADE_GREAT_MIN) return 'Great'
  if (phaseAcc >= PHASE_GRADE_EXCELLENT_MIN) return 'Excellent'
  if (phaseAcc >= PHASE_GRADE_GOOD_MIN) return 'Good'
  if (phaseAcc >= PHASE_GRADE_INACCURACY_MIN) return 'Inaccuracy'
  if (phaseAcc >= PHASE_GRADE_MISTAKE_MIN) return 'Mistake'
  return 'Blunder'
}

export interface GameSummary {
  accuracy: number | null
  phaseAccuracy: { opening: number | null; middlegame: number | null; endgame: number | null }
  phaseGrades: { opening: PhaseGrade | null; middlegame: PhaseGrade | null; endgame: PhaseGrade | null }
  classificationCounts: Record<MoveClass, number>
  gameRating: number | null
}

export function buildGameSummary(
  analyses: MoveAnalysis[],
  player: 'white' | 'black',
  opponentElo?: number,
): GameSummary {
  const accuracy = playerAccuracy(analyses, player)
  const phaseAcc = phaseAccuracy(analyses, player)
  const gameRating = estimateGameRating({ analyses, player, accuracy, opponentElo })

  return {
    accuracy,
    phaseAccuracy: phaseAcc,
    phaseGrades: {
      opening: phaseGrade(phaseAcc.opening),
      middlegame: phaseGrade(phaseAcc.middlegame),
      endgame: phaseGrade(phaseAcc.endgame),
    },
    classificationCounts: classificationCounts(analyses, player),
    gameRating,
  }
}
