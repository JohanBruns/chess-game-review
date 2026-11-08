import type { MoveClass } from './classify'

// How a move is printed in the move list and the phone move strip.

// Which classifications chess.com surfaces in the move list — an inline icon AND a colored SAN.
// Verified against a live Game Review move list (Board&Game/review/Screenshot_3, game
// 171300157032): Best moves DO get a green star + green text; the routine Excellent/Good band
// gets neither (default light text, no icon), and Forced is our own class with no equivalent.
export const MARKED_CLASSES = new Set<MoveClass>([
  'Book', 'Brilliant', 'Great', 'Best', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder',
])

// Piece letter → filled Unicode figurine, drawn in place of the SAN's leading letter (Nf3 → ♞f3)
// like chess.com. Pawn moves and castling have no leading piece letter and render unchanged. The
// glyph inherits the surrounding text color, so a colored move tints its figurine to match.
const FIGURINE: Record<string, string> = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞',
}

export function splitSan(san: string): { figurine: string | null; text: string } {
  const figurine = FIGURINE[san[0]]
  return figurine ? { figurine, text: san.slice(1) } : { figurine: null, text: san }
}
