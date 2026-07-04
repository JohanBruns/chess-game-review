import { Chess } from 'chess.js'

export interface AttemptResult {
  san: string
  fenAfter: string
}

// Attempts a user-dragged move on the given position, auto-queening on promotion (no
// promotion-choice UI in this app). Returns null if the move is illegal — the board should
// snap the piece back in that case.
export function attemptMove(fen: string, from: string, to: string): AttemptResult | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move({ from, to, promotion: 'q' })
    if (!move) return null
    return { san: move.san, fenAfter: chess.fen() }
  } catch {
    return null
  }
}

// Same equality check classify.ts uses for the 'Best' classification (isEngineBestMove) —
// exact SAN match, no near-best tolerance. bestMoveSan === null means "no engine reference
// available for this position" (tri-state), not "wrong".
export function isBestMove(attemptedSan: string, bestMoveSan: string | null): boolean | null {
  return bestMoveSan === null ? null : attemptedSan === bestMoveSan
}
