import type { MoveClass } from './classify'
import type { TacticalTheme, ThemeKind, ThemeHighlight } from './tactics'
import { reviewHeadline } from './review'

// A run of coach text; the highlight-bearing variant is a hoverable phrase that lights up its
// squares/arrows on the board.
export type CommentToken = { text: string } | { text: string; highlight: ThemeHighlight }

export interface CommentaryContext {
  san: string
  classification: MoveClass
  isEnginesBest: boolean
  bestSan: string | null
  themes: TacticalTheme[]
  ply: number
}

// Which theme kinds are worth voicing for a given move quality. A blunder is explained by what
// went wrong (hanging/mate allowed/chance missed); a strong move by what it achieves (mate/fork).
const NEGATIVE: ThemeKind[] = ['allowsMate', 'hangingPiece']
const MISSED: ThemeKind[] = ['missedMate', 'missedWin']
const POSITIVE: ThemeKind[] = ['mateThreat', 'fork', 'attacksHigherValue']

function allowedKinds(cls: MoveClass): Set<ThemeKind> {
  if (cls === 'Miss') return new Set([...MISSED, ...NEGATIVE])
  if (cls === 'Blunder' || cls === 'Mistake' || cls === 'Inaccuracy') return new Set([...NEGATIVE, ...MISSED])
  if (cls === 'Brilliant' || cls === 'Great' || cls === 'Best' || cls === 'Excellent') return new Set(POSITIVE)
  return new Set(POSITIVE) // Good / Book / Forced — usually no notable theme, falls back to the headline
}

// Deterministic pick (seeded by ply) so tests are stable while wording still varies across moves.
function pickVariant<T>(ply: number, options: T[]): T {
  return options[Math.abs(ply) % options.length]
}

// Builds the coach's move commentary as tokens: the classification headline followed by up to two
// hoverable tactical phrases. With no relevant theme it degrades to exactly today's plain headline.
export function buildCommentary(ctx: CommentaryContext): CommentToken[] {
  const base = reviewHeadline(ctx.san, ctx.classification, ctx.isEnginesBest)
  const allowed = allowedKinds(ctx.classification)
  const themes = ctx.themes.filter(t => allowed.has(t.kind)).slice(0, 2)
  if (themes.length === 0) return [{ text: base }]

  const connector = pickVariant(ctx.ply, [' — ', ': '])
  const tokens: CommentToken[] = [{ text: `${base}${connector}` }]
  tokens.push({ text: themes[0].description, highlight: themes[0].highlight })
  if (themes.length > 1) {
    tokens.push({ text: ', and ' })
    tokens.push({ text: themes[1].description, highlight: themes[1].highlight })
  }
  tokens.push({ text: '.' })
  return tokens
}
