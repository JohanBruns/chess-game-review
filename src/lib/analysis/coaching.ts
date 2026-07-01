import type { EvalResult } from '../engine/useEngine'
import type { MoveAnalysis } from './classify'
import { winPct } from './classify'

export const SYSTEM_PROMPT = `You are a concise chess coach. Explain a single move in \
2-3 sentences, understandable for a club player (roughly 1200 Elo). Do NOT evaluate \
the position yourself — use only the engine data provided. \
No filler phrases, no empty praise. Language: English.`

function evalToCp(r: EvalResult): number {
  if (r.cp !== null) return r.cp
  if (r.mate !== null) return r.mate > 0 ? 10000 : -10000
  return 0
}

function formatEval(r: EvalResult): string {
  if (r.mate !== null) return r.mate > 0 ? `Mate in ${r.mate}` : `Mate in ${-r.mate} (opponent)`
  if (r.cp !== null) {
    if (r.cp >= 10000) return 'Mate (for you)'
    if (r.cp <= -10000) return 'Mate (for opponent)'
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

  return `Position (FEN): ${fenBefore}
Move played: ${sanPlayed}
Engine eval before: ${formatEval(evalBefore)} (${wpBefore}%)
Engine eval after: ${formatEval(evalAfter)} (${wpAfter}%)
Best move per engine: ${bestMove}  → Main line: ${pv}
Classification: ${analysis.classification}   (win-% loss: ${analysis.lossInWinPct.toFixed(1)}%)

Explain: Why is this move ${analysis.classification}? Why would ${bestMove} have been better, and what concrete idea/threat is behind it?`
}
