import type { MoveClass } from './classify'

// Per-classification colors as bare "r, g, b" triples so callers can compose their own alpha
// (square-highlight tints, graph dots, legend swatches). Verified 2026-07-04 against a live
// chess.com Game Review (DevTools computed styles). Book is a neutral last-move tint, not a
// real classification color; Forced is our own proprietary class with no chess.com equivalent.
export const CLASS_COLOR: Record<MoveClass, string> = {
  Brilliant:  '38, 194, 163',
  Great:      '116, 155, 191',
  Best:       '129, 182, 76',   // var(--color-cc-green)
  Excellent:  '129, 182, 76',
  Good:       '149, 183, 118',
  Book:       '240, 210, 100',
  Inaccuracy: '247, 198, 49',
  Mistake:    '255, 164, 89',
  Blunder:    '250, 65, 45',
  Miss:       '255, 119, 105',
  Forced:     '128, 128, 128',
}

// Convenience wrapper: `classColor('Blunder')` → "rgb(250, 65, 45)",
// `classColor('Blunder', 0.55)` → "rgba(250, 65, 45, 0.55)".
export function classColor(cls: MoveClass, alpha = 1): string {
  return alpha === 1 ? `rgb(${CLASS_COLOR[cls]})` : `rgba(${CLASS_COLOR[cls]}, ${alpha})`
}
