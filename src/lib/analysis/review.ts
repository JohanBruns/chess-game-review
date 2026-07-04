import { Chess, type Square } from 'chess.js'
import type { MoveClass } from './classify'
import type { EvalResult } from '../engine/useEngine'

export interface LineStep {
  san: string
  fen: string
  from: Square
  to: Square
}

export interface BestPreview {
  san: string
  fen: string
  from: Square
  to: Square
}

// "e4 is a book move" / "O-O is best" / "Qxg4 is a miss" / ...
// isEnginesBest covers the (classification !== 'Best') edge case where the played move
// happens to equal the engine's top move but got classified otherwise (shouldn't normally
// happen, but keeps the headline honest if it does).
export function reviewHeadline(san: string, cls: MoveClass, isEnginesBest: boolean): string {
  if (cls === 'Book') return `${san} is a book move`
  if (isEnginesBest || cls === 'Best') return `${san} is best`

  const phrase: Record<Exclude<MoveClass, 'Book' | 'Best'>, string> = {
    Brilliant: 'is a brilliant move',
    Great: 'is a great move',
    Excellent: 'is excellent',
    Good: 'is a good move',
    Inaccuracy: 'is an inaccuracy',
    Mistake: 'is a mistake',
    Blunder: 'is a blunder',
    Miss: 'is a miss',
    Forced: 'is forced',
  }
  return `${san} ${phrase[cls]}`
}

// White-perspective compact eval badge: "+4.21" / "-0.09" / "M5" / "-M3"
export function formatEvalBadge(r: EvalResult | null): string {
  if (!r) return ''
  if (r.mate !== null && r.mate !== 0) return r.mate > 0 ? `M${r.mate}` : `-M${-r.mate}`
  if (r.cp !== null) {
    if (r.cp >= 10000) return 'M+'
    if (r.cp <= -10000) return 'M-'
    const p = r.cp / 100
    return p >= 0 ? `+${p.toFixed(2)}` : p.toFixed(2)
  }
  return '0.00'
}

// Resolves a PV SAN string ("g5 exf5 e4 ...") starting from fenBefore into board-ready
// steps. Stops (without throwing) at the first SAN chess.js can't parse, so a corrupted
// or truncated PV still yields a usable partial walkthrough.
export function buildLineSteps(fenBefore: string, pv: string | null): LineStep[] {
  if (!pv) return []
  const chess = new Chess(fenBefore)
  const steps: LineStep[] = []
  for (const san of pv.split(' ')) {
    if (!san) continue
    try {
      const m = chess.move(san)
      steps.push({ san: m.san, fen: chess.fen(), from: m.from, to: m.to })
    } catch {
      break
    }
  }
  return steps
}

// Applies the engine's best move to fenBefore, returning the resulting preview position
// plus board coordinates. Used to render the "Best" sub-mode's board state.
export function buildBestPreview(fenBefore: string, bestSan: string | null): BestPreview | null {
  if (!bestSan) return null
  try {
    const chess = new Chess(fenBefore)
    const m = chess.move(bestSan)
    return { san: m.san, fen: chess.fen(), from: m.from, to: m.to }
  } catch {
    return null
  }
}
