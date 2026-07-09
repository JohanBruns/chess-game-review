import type { MoveClass } from './classify'
import type { TacticalTheme, ThemeKind, ThemeHighlight } from './tactics'

// A run of coach text; the highlight-bearing variant is a hoverable phrase that lights up its
// squares/arrows on the board.
export type CommentToken = { text: string } | { text: string; highlight: ThemeHighlight }

export interface CommentaryContext {
  classification: MoveClass
  themes: TacticalTheme[]
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

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s
}

// Builds the coach's move explanation as up to two hoverable tactical phrases (the "why" line
// under the classification headline). Returns an empty array when no theme applies — the coach
// bubble then shows just the headline, with no second line.
export function buildCommentary(ctx: CommentaryContext): CommentToken[] {
  const allowed = allowedKinds(ctx.classification)
  const themes = ctx.themes.filter(t => allowed.has(t.kind)).slice(0, 2)
  if (themes.length === 0) return []

  const tokens: CommentToken[] = [
    { text: capitalize(themes[0].description), highlight: themes[0].highlight },
  ]
  if (themes.length > 1) {
    tokens.push({ text: ', and ' })
    tokens.push({ text: themes[1].description, highlight: themes[1].highlight })
  }
  tokens.push({ text: '.' })
  return tokens
}
