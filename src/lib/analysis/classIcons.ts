import type { MoveClass } from './classify'

// Display order for the SummaryCard classification table, matching a live chess.com Game
// Review (2026-07-08 checkpoint, game 171190174548). Forced is our own proprietary class
// (no chess.com equivalent) and is intentionally excluded.
export const CLASS_DISPLAY_ORDER: MoveClass[] = [
  'Brilliant', 'Great', 'Book', 'Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Miss', 'Blunder',
]

export const CLASS_ICON: Record<MoveClass, string> = {
  Book:        '/marks/book_128x.png',
  Brilliant:   '/marks/brilliant_128x.png',
  Great:       '/marks/great_find_128x.png',
  Best:        '/marks/best_128x.png',
  Excellent:   '/marks/excellent_128x.png',
  Good:        '/marks/good_128x.png',
  Inaccuracy:  '/marks/inaccuracy_128x.png',
  Mistake:     '/marks/mistake_128x.png',
  Blunder:     '/marks/blunder_128x.png',
  Miss:        '/marks/miss_128x.png',
  Forced:      '/marks/forced_128x.png',
}
