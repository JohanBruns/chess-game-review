import { Chess, type Square } from 'chess.js'
import type { MoveClass } from './classify'
import type { EvalResult } from '../engine/useEngine'
import type { GameSummary } from './summary'

export interface LineStep {
  san: string
  fen: string
  from: Square
  to: Square
  captured: boolean
}

export interface BestPreview {
  san: string
  fen: string
  from: Square
  to: Square
}

// The coach headline split into its three visually-distinct runs, so callers (the coach bubble)
// can color/bold the SAN and classification word while keeping the connective words plain — e.g.
// "Bxf7+" (colored) + "is a" (plain) + "blunder" (colored).
export interface HeadlineParts {
  san: string
  middle: string
  classWord: string
}

const CLASS_PHRASE: Record<Exclude<MoveClass, 'Book' | 'Best'>, [middle: string, classWord: string]> = {
  Brilliant: ['is a', 'brilliant move'],
  Great: ['is a', 'great move'],
  Excellent: ['is', 'excellent'],
  Good: ['is a', 'good move'],
  Inaccuracy: ['is an', 'inaccuracy'],
  Mistake: ['is a', 'mistake'],
  Blunder: ['is a', 'blunder'],
  Miss: ['is a', 'miss'],
  Forced: ['is', 'forced'],
}

// isEnginesBest covers the (classification !== 'Best') edge case where the played move
// happens to equal the engine's top move but got classified otherwise (shouldn't normally
// happen, but keeps the headline honest if it does).
export function reviewHeadlineParts(san: string, cls: MoveClass, isEnginesBest: boolean): HeadlineParts {
  if (cls === 'Book') return { san, middle: 'is a', classWord: 'book move' }
  if (isEnginesBest || cls === 'Best') return { san, middle: 'is', classWord: 'best' }
  const [middle, classWord] = CLASS_PHRASE[cls]
  return { san, middle, classWord }
}

// "e4 is a book move" / "O-O is best" / "Qxg4 is a miss" / ...
export function reviewHeadline(san: string, cls: MoveClass, isEnginesBest: boolean): string {
  const { middle, classWord } = reviewHeadlineParts(san, cls, isEnginesBest)
  return `${san} ${middle} ${classWord}`
}

// A PV's mate count applies to the position BEFORE the whole line — as the coach's Explain mode
// steps through it move by move, that number must count down instead of staying frozen at the
// original value (the bug: the eval bar/badge looked like it never moved while stepping a mate
// line). The side delivering mate never changes along the line, so the sign is stable; only the
// magnitude (moves left) shrinks by roughly one per full move played.
export function explainStepMate(mate: number, lineLength: number, step: number): number {
  const remainingPlies = Math.max(0, lineLength - (step + 1))
  // `|| 0` normalizes -0 (Math.sign(-2) * 0) to a plain 0 at the delivered-mate step.
  return Math.sign(mate) * Math.ceil(remainingPlies / 2) || 0
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
      steps.push({ san: m.san, fen: chess.fen(), from: m.from, to: m.to, captured: m.captured != null })
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

// The coach's opening line on the Summary view (chapter 1), e.g. "You had a nice tactical
// find in this game. Let's review!" (live-verified wording, 2026-07-08 checkpoint). Picks the
// most notable highlight across both players — a Brilliant beats a Great beats a high-accuracy
// game beats the generic fallback.
export function summaryHeadline(whiteSummary: GameSummary, blackSummary: GameSummary): string {
  const brilliantCount =
    whiteSummary.classificationCounts.Brilliant + blackSummary.classificationCounts.Brilliant
  const greatCount = whiteSummary.classificationCounts.Great + blackSummary.classificationCounts.Great
  const bestAccuracy = Math.max(whiteSummary.accuracy ?? 0, blackSummary.accuracy ?? 0)

  if (brilliantCount > 0) return "You found a brilliant move in this game. Let's review!"
  if (greatCount > 0) return "You had a nice tactical find in this game. Let's review!"
  if (bestAccuracy >= 90) return "You played an excellent game. Let's review!"
  return "Let's review your game!"
}
