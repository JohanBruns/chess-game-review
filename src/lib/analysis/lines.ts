import type { EvalResult } from '../engine/useEngine'

export interface EngineLine {
  san: string
  cp: number | null
  mate: boolean
}

// The ±10000 cp sentinel useEngine.ts uses in place of an actual mate score
// (see the comment in useEngine.ts's info-line parser).
const MATE_CP_SENTINEL = 10000

// Maps an EvalResult's up-to-3 MultiPV lines (best/2nd/3rd) into an ordered list for
// display, best first. Entries whose move is unknown (null SAN) are dropped rather than
// rendered as a blank row — this happens for MultiPV lines Stockfish never reported
// (e.g. very few legal moves in the position).
export function getEngineLines(evalResult: EvalResult | null): EngineLine[] {
  if (!evalResult) return []
  const candidates: { san: string | null; cp: number | null }[] = [
    { san: evalResult.bestMoveSan, cp: evalResult.cp },
    { san: evalResult.secondBestMoveSan, cp: evalResult.secondBestCp },
    { san: evalResult.thirdBestMoveSan, cp: evalResult.thirdBestCp },
  ]
  const lines: EngineLine[] = []
  for (const { san, cp } of candidates) {
    if (san === null) continue
    lines.push({ san, cp, mate: cp !== null && Math.abs(cp) >= MATE_CP_SENTINEL })
  }
  return lines
}
