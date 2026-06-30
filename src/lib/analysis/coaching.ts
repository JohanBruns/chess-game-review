import type { EvalResult } from '../engine/useEngine'
import type { MoveAnalysis } from './classify'
import { winPct } from './classify'

export const SYSTEM_PROMPT = `Du bist ein prägnanter Schachtrainer. Erkläre einen einzelnen Zug in \
2–3 Sätzen, verständlich für ein Vereinsmitglied (ca. 1200 Elo). Bewerte die \
Stellung NICHT selbst — nutze ausschließlich die gelieferten Engine-Daten. \
Keine Floskeln, kein Lob ohne Inhalt. Sprache: Deutsch.`

function evalToCp(r: EvalResult): number {
  if (r.cp !== null) return r.cp
  if (r.mate !== null) return r.mate > 0 ? 10000 : -10000
  return 0
}

function formatEval(r: EvalResult): string {
  if (r.mate !== null) return r.mate > 0 ? `Matt in ${r.mate}` : `Matt in ${-r.mate} (Gegner)`
  if (r.cp !== null) {
    const p = r.cp / 100
    return p > 0 ? `+${p.toFixed(2)}` : p.toFixed(2)
  }
  return '0.00'
}

export function buildCoachingPrompt(params: {
  fenBefore: string
  sanPlayed: string
  evalBefore: EvalResult
  evalAfter: EvalResult
  analysis: MoveAnalysis
}): string {
  const { fenBefore, sanPlayed, evalBefore, evalAfter, analysis } = params
  const wpBefore = winPct(evalToCp(evalBefore)).toFixed(1)
  const wpAfter = winPct(evalToCp(evalAfter)).toFixed(1)
  const bestMove = evalBefore.bestMoveSan ?? '?'
  const pv = evalBefore.pv ?? bestMove

  return `Stellung (FEN): ${fenBefore}
Gespielter Zug: ${sanPlayed}
Engine-Bewertung vorher: ${formatEval(evalBefore)} (${wpBefore}%)
Engine-Bewertung nachher: ${formatEval(evalAfter)} (${wpAfter}%)
Bester Zug laut Engine: ${bestMove}  → Hauptvariante: ${pv}
Klassifizierung: ${analysis.classification}   (Win-%-Verlust: ${analysis.lossInWinPct.toFixed(1)}%)

Erkläre: Warum ist dieser Zug ${analysis.classification}? Was wäre ${bestMove} besser gewesen und welche konkrete Idee/Drohung steckt dahinter?`
}
