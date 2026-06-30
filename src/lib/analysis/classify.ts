import { Chess, type Move } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'

export type MoveClass =
  | 'Book'
  | 'Brilliant'
  | 'Great'
  | 'Best'
  | 'Excellent'
  | 'Good'
  | 'Inaccuracy'
  | 'Mistake'
  | 'Blunder'

export interface MoveAnalysis {
  moveIndex: number
  lossInWinPct: number
  classification: MoveClass
  accuracy: number
}

export function moveAccuracy(lossInWinPct: number): number {
  const raw = 103.1668 * Math.exp(-0.04354 * lossInWinPct) - 3.1669
  return Math.min(100, Math.max(0, raw))
}

export function playerAccuracy(
  analyses: MoveAnalysis[],
  player: 'white' | 'black',
): number | null {
  const playerMoves = analyses.filter(a =>
    (player === 'white' ? a.moveIndex % 2 === 0 : a.moveIndex % 2 !== 0) &&
    a.classification !== 'Book',
  )
  if (playerMoves.length === 0) return null
  return playerMoves.reduce((sum, a) => sum + a.accuracy, 0) / playerMoves.length
}

export function winPct(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1)
}

function evalToCp(r: EvalResult): number {
  if (r.cp !== null) return r.cp
  if (r.mate !== null) return r.mate > 0 ? 10000 : -10000
  return 0
}

// Piece values for sacrifice detection
const PIECE_VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

// A move is a sacrifice when material is given without immediate equal compensation.
// Two cases:
//   a) Direct exchange sacrifice: captured piece worth less than moving piece
//   b) Piece hangs on destination (non-pawn only — pawn advances to defended squares are normal play)
export function isSacrifice(move: Move): boolean {
  if (!move.piece || !move.color || !move.after) return false
  const pieceVal = PIECE_VAL[move.piece] ?? 0

  if (move.captured) {
    return (PIECE_VAL[move.captured] ?? 0) < pieceVal
  }

  if (pieceVal <= 1) return false  // pawn non-capture: skip
  try {
    const chess = new Chess(move.after)
    const oppColor = move.color === 'w' ? 'b' : 'w'
    return chess.isAttacked(move.to, oppColor)
  } catch {
    return false
  }
}

// Optional params enable Brilliant/Great detection when full context is available.
// Callers that only have loss+isEngineBestMove (e.g. tests) get the standard 7-class result.
export function classifyMove(
  loss: number,
  isEngineBestMove: boolean,
  move?: Move,
  winPctBefore?: number,
  bestCp?: number | null,
  secondBestCp?: number | null,
): MoveClass {
  // Brilliant: sacrifice + nearly best + position not already trivially won
  if (
    move != null && winPctBefore != null &&
    loss <= 2 && winPctBefore < 90 &&
    isSacrifice(move)
  ) return 'Brilliant'

  // Great: clearly best move where 2nd-best is significantly worse (only good move)
  if (
    isEngineBestMove &&
    bestCp != null && secondBestCp != null &&
    winPctBefore != null && winPctBefore < 85 &&
    winPct(bestCp) - winPct(secondBestCp) >= 10
  ) return 'Great'

  if (isEngineBestMove) return 'Best'
  if (loss <= 2) return 'Excellent'
  if (loss <= 5) return 'Good'
  if (loss <= 10) return 'Inaccuracy'
  if (loss <= 20) return 'Mistake'
  return 'Blunder'
}

export function findKeyMoments(analyses: MoveAnalysis[], n = 5): Set<number> {
  const sorted = [...analyses]
    .filter(a => a.classification !== 'Book')
    .sort((a, b) => b.lossInWinPct - a.lossInWinPct)
  return new Set(sorted.slice(0, n).map(a => a.moveIndex))
}

export function buildMoveAnalyses(
  moves: Move[],
  evalResults: (EvalResult | null)[],
  openingPly = 0,
): MoveAnalysis[] {
  const analyses: MoveAnalysis[] = []

  for (let i = 0; i < moves.length; i++) {
    if (i < openingPly) {
      analyses.push({ moveIndex: i, lossInWinPct: 0, classification: 'Book', accuracy: 100 })
      continue
    }
    const evalBefore = evalResults[i]
    const evalAfter = evalResults[i + 1]
    if (!evalBefore || !evalAfter) continue

    const isWhite = i % 2 === 0
    const cpBefore = isWhite ? evalToCp(evalBefore) : -evalToCp(evalBefore)
    const cpAfter  = isWhite ? evalToCp(evalAfter)  : -evalToCp(evalAfter)

    const loss = Math.max(0, winPct(cpBefore) - winPct(cpAfter))
    const isEngineBestMove =
      evalBefore.bestMoveSan !== null && moves[i].san === evalBefore.bestMoveSan

    // Convert secondBestCp from White-perspective (stored in EvalResult) to mover's perspective
    const secondBestCpMover =
      evalBefore.secondBestCp !== null
        ? (isWhite ? evalBefore.secondBestCp : -evalBefore.secondBestCp)
        : null

    analyses.push({
      moveIndex: i,
      lossInWinPct: loss,
      classification: classifyMove(
        loss,
        isEngineBestMove,
        moves[i],
        winPct(cpBefore),
        cpBefore,
        secondBestCpMover,
      ),
      accuracy: moveAccuracy(loss),
    })
  }

  return analyses
}
