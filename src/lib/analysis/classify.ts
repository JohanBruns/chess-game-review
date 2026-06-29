import type { Move } from 'chess.js'
import type { EvalResult } from '../engine/useEngine'

export type MoveClass = 'Best' | 'Excellent' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder'

export interface MoveAnalysis {
  moveIndex: number
  lossInWinPct: number
  classification: MoveClass
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

export function buildMoveAnalyses(
  moves: Move[],
  evalResults: (EvalResult | null)[],
): MoveAnalysis[] {
  const analyses: MoveAnalysis[] = []

  for (let i = 0; i < moves.length; i++) {
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
    })
  }

  return analyses
}
