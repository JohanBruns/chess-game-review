// "Open the app and your last game is there" — when the Home Screen app should load the user's
// newest chess.com game by itself, and when it should only offer it. The share-sheet route
// (docs/iphone.md) stays for games the archive doesn't list yet.

// What made the app look: a cold start, coming back to the front, or the periodic re-check while
// it stays open (the public archive can lag a few minutes behind a game that just ended).
export type NewestGameTrigger = 'start' | 'resume' | 'poll'

// Away at least this long counts as "went off and played a game" when coming back.
export const RESUME_AWAY_MS = 60_000
// While the app stays open, look again this often, for this long after each opening.
export const NEWEST_POLL_INTERVAL_MS = 60_000
export const NEWEST_POLL_WINDOW_MS = 5 * 60_000

export interface NewestGameInput {
  trigger: NewestGameTrigger
  // chess.com id of the newest game in the archive (null: none / couldn't fetch).
  newestId: string | null
  // chess.com id of the game on the board (null: none, or not a chess.com game).
  loadedId: string | null
  // Whether any game is on the board at all.
  hasGame: boolean
  // The newest game this decision was last made for — each game is loaded or offered once.
  lastHandledId: string | null
  // How long the app was in the background before this 'resume'.
  awayMs: number
  // Practice / puzzles / an analysis or link load in progress: never swap the game under them.
  busy: boolean
}

export type NewestGameAction = 'load' | 'offer' | null

export function decideNewestGame(input: NewestGameInput): NewestGameAction {
  const { trigger, newestId, loadedId, hasGame, lastHandledId, awayMs, busy } = input
  if (!newestId || newestId === loadedId) return null
  if (trigger === 'start') {
    // A cold start with nothing else asked for (no link, no shared game): show the newest game,
    // even one reviewed before — its analysis comes straight from the cache.
    if (hasGame) return null
    return busy ? 'offer' : 'load'
  }
  if (newestId === lastHandledId) return null
  if (trigger === 'resume' && awayMs >= RESUME_AWAY_MS && !busy) return 'load'
  return 'offer'
}

// "https://www.chess.com/game/live/123456" → "123456".
export function gameIdFromUrl(url: string | null | undefined): string | null {
  return url?.match(/\/game\/(?:(?:live|daily)\/)?(\d+)/)?.[1] ?? null
}
