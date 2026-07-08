import type { MoveAnalysis } from './classify'

export interface GameRatingInput {
  analyses: MoveAnalysis[]
  player: 'white' | 'black'
  accuracy: number | null
  opponentElo?: number
}

// Monotone piecewise-linear accuracy% -> Elo calibration table. Endpoints and shape are a
// rough fit to chess.com's published Game Rating examples — not derived from their (closed)
// formula. Below the first accuracy point the rating clamps to the first Elo point; above the
// last, to the last.
const ACCURACY_ELO_TABLE: [accuracy: number, elo: number][] = [
  [50, 250],
  [60, 600],
  [70, 950],
  [78, 1350],
  [85, 1750],
  [90, 2050],
  [94, 2350],
  [97, 2600],
  [99, 2850],
  [100, 3100],
]

function accuracyToElo(accuracy: number): number {
  const table = ACCURACY_ELO_TABLE
  if (accuracy <= table[0][0]) return table[0][1]
  if (accuracy >= table[table.length - 1][0]) return table[table.length - 1][1]
  for (let i = 0; i < table.length - 1; i++) {
    const [accLo, eloLo] = table[i]
    const [accHi, eloHi] = table[i + 1]
    if (accuracy >= accLo && accuracy <= accHi) {
      const t = (accuracy - accLo) / (accHi - accLo)
      return eloLo + t * (eloHi - eloLo)
    }
  }
  return table[table.length - 1][1]
}

// Per-classification Elo adjustment, applied per occurrence and normalized by the number of
// rated (non-Book/Forced) moves — a single blunder in a 15-move game hurts far more than one
// in an 80-move game.
const CLASS_ADJUSTMENT: Partial<Record<MoveAnalysis['classification'], number>> = {
  Blunder: -40,
  Miss: -30,
  Mistake: -20,
  Brilliant: 30,
  Great: 15,
}

// Below this many rated moves, the raw estimate is regressed toward the opponent's rating
// (or, absent that, left alone) — too small a sample to trust on its own.
const MIN_SAMPLE_SIZE = 12
const RATING_MIN = 100
const RATING_MAX = 3500
const ROUND_TO = 50

export function estimateGameRating(input: GameRatingInput): number | null {
  const { analyses, player, accuracy, opponentElo } = input
  if (accuracy == null) return null

  const playerMoves = analyses.filter(a =>
    (player === 'white' ? a.moveIndex % 2 === 0 : a.moveIndex % 2 !== 0) &&
    a.classification !== 'Book' && a.classification !== 'Forced',
  )

  const baseElo = accuracyToElo(accuracy)

  let adjustment = 0
  if (playerMoves.length > 0) {
    let adjustmentSum = 0
    for (const move of playerMoves) {
      adjustmentSum += CLASS_ADJUSTMENT[move.classification] ?? 0
    }
    adjustment = adjustmentSum / playerMoves.length
  }

  let rating = baseElo + adjustment

  if (playerMoves.length < MIN_SAMPLE_SIZE && opponentElo != null) {
    const t = playerMoves.length / MIN_SAMPLE_SIZE
    rating = opponentElo + t * (rating - opponentElo)
  }

  rating = Math.min(RATING_MAX, Math.max(RATING_MIN, rating))
  return Math.round(rating / ROUND_TO) * ROUND_TO
}
