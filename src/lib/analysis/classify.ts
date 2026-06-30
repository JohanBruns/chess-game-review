import type { Move } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'

export type MoveClass = 'Book' | 'Best' | 'Excellent' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder'

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

export function classifyMove(loss: number, isEngineBestMove: boolean): MoveClass {
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
    const cpAfter = isWhite ? evalToCp(evalAfter) : -evalToCp(evalAfter)

    const loss = Math.max(0, winPct(cpBefore) - winPct(cpAfter))
    const isEngineBestMove =
      evalBefore.bestMoveSan !== null && moves[i].san === evalBefore.bestMoveSan

    analyses.push({
      moveIndex: i,
      lossInWinPct: loss,
      classification: classifyMove(loss, isEngineBestMove),
      accuracy: moveAccuracy(loss),
    })
  }

  return analyses
}
