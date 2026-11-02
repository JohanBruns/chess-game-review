// Loading a chess.com game from a shared link — what the chess.com iPhone app hands out when
// you tap "Share" on a game: no PGN, just a sentence like
//   "Schauen Sie sich dieses #Schachspiel an: jojo2go gegen RiCk_Prime_C137 - https://www.chess.com/game/185820408402"
// (wording depends on the app language). See docs/iphone.md for the iOS Shortcut that sends it
// here as ?share=<text>.

export interface SharedGame {
  id: string
  // 'live' | 'daily' when the link says so; the app's short /game/{id} links don't.
  type: 'live' | 'daily' | null
  // Both players' usernames when the share text names them — lets the official archive API
  // find the game if the callback proxy is unavailable.
  usernames: string[]
}

const GAME_LINK_RE = /chess\.com\/(?:[a-z]{2}\/)?(?:analysis\/)?game\/(?:(live|daily)\/)?(\d+)/i
// "<user> <gegen|vs.|contre|…> <user> - https://…": usernames are 3–25 of [A-Za-z0-9_-].
const PLAYERS_RE = /([\w-]{3,25})\s+\S+\s+([\w-]{3,25})\s+-\s+https?:\/\//

export function parseSharedGame(text: string): SharedGame | null {
  const trimmed = text.trim()
  // A chess.com PGN carries its own game link in a [Link "…"] header — that's a PGN, not a link.
  if (/^\[\w+\s+"/.test(trimmed) || /\b1\.\s*[a-hNBRQKO]/.test(trimmed)) return null
  if (/^\d{6,}$/.test(trimmed)) return { id: trimmed, type: null, usernames: [] }
  const link = trimmed.match(GAME_LINK_RE)
  if (!link) return null
  const players = trimmed.match(PLAYERS_RE)
  return {
    id: link[2],
    type: (link[1]?.toLowerCase() as 'live' | 'daily' | undefined) ?? null,
    usernames: players ? [players[1], players[2]] : [],
  }
}

// The subset of https://www.chess.com/callback/{live|daily}/game/{id} this module reads.
export interface CallbackGame {
  pgn?: string
  moveList?: string
  moveTimestamps?: string
  pgnHeaders?: Record<string, string | number>
}

// The callback JSON has no PGN field — only `pgnHeaders`, the moves as a TCN-encoded
// `moveList` and `moveTimestamps` (remaining clock per ply, in tenths of a second).
// Rebuilds a PGN from those. Moves are written in coordinate notation (e2e4, e7e8q), which
// chess.js's lenient PGN parser in useGame accepts and converts to SAN.
// Same logic as extension/content.js, which can't import from here.
export function buildPgnFromCallbackGame(game: CallbackGame | null | undefined): string | null {
  if (typeof game?.pgn === 'string' && game.pgn.length > 10) return game.pgn
  if (!game?.moveList || typeof game.moveList !== 'string') return null
  const moves = decodeTcn(game.moveList)
  if (!moves || moves.length === 0) return null

  const headers = game.pgnHeaders ?? {}
  const headerLines = Object.entries(headers).map(
    ([key, value]) => `[${key} "${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`,
  )

  const clocks = typeof game.moveTimestamps === 'string'
    ? game.moveTimestamps.split(',').map(Number)
    : []
  const tokens: string[] = []
  moves.forEach((move, i) => {
    if (i % 2 === 0) tokens.push(`${i / 2 + 1}.`)
    tokens.push(move)
    if (Number.isFinite(clocks[i])) tokens.push(`{[%clk ${formatClock(clocks[i])}]}`)
  })
  tokens.push(String(headers.Result ?? '*'))

  return `${headerLines.join('\n')}\n\n${tokens.join(' ')}`
}

// chess.com's TCN: two chars per move, each char indexes a square (a1=0 … h8=63). A target
// char past 63 encodes a promotion: piece = (idx-64)/3, file offset = (idx-64)%3 - 1.
export function decodeTcn(tcn: string): string[] | null {
  const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++='
  const PROMOTION_PIECES = 'qnrb'
  const square = (idx: number) => 'abcdefgh'[idx % 8] + (Math.floor(idx / 8) + 1)
  const moves: string[] = []
  for (let i = 0; i + 1 < tcn.length; i += 2) {
    const from = ALPHABET.indexOf(tcn[i])
    let to = ALPHABET.indexOf(tcn[i + 1])
    if (from < 0 || from > 63 || to < 0) return null // drop moves (variants) — unsupported
    let promotion = ''
    if (to > 63) {
      promotion = PROMOTION_PIECES[Math.floor((to - 64) / 3)] ?? ''
      if (!promotion) return null
      to = from + (from < 16 ? -8 : 8) + ((to - 64) % 3) - 1
    }
    moves.push(square(from) + square(to) + promotion)
  }
  return moves
}

// Tenths of a second → chess.com's %clk format "H:MM:SS.t"
function formatClock(tenths: number): string {
  const totalSeconds = tenths / 10
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = (totalSeconds % 60).toFixed(1).padStart(4, '0')
  return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
}

// Same-origin serverless proxy (api/chesscom-game.ts) for the callback endpoint — chess.com
// doesn't send CORS headers there, so the browser can't call it directly. It's available the
// instant a game ends; not present under `npm run dev`, where the archive fallback takes over.
async function fetchViaCallbackProxy(shared: SharedGame): Promise<string | null> {
  try {
    const typeParam = shared.type ? `&type=${shared.type}` : ''
    const res = await fetch(`/api/chesscom-game?id=${shared.id}${typeParam}`)
    if (!res.ok) return null
    const json = await res.json() as { game?: CallbackGame }
    return buildPgnFromCallbackGame(json.game)
  } catch {
    return null
  }
}

// Official public API (CORS-enabled): a player's monthly archive, searched for the game id.
// Needs a username and can lag a few minutes behind a just-finished game.
async function fetchViaArchive(id: string, username: string): Promise<string | null> {
  const now = new Date()
  for (let back = 0; back < 3; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    try {
      const res = await fetch(
        `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}/games/${d.getFullYear()}/${month}`,
      )
      if (!res.ok) continue
      const json = await res.json() as { games?: { url?: string; pgn?: string }[] }
      const game = json.games?.find(g => g.url?.endsWith(`/${id}`))
      if (game?.pgn) return game.pgn
    } catch {
      // try the previous month
    }
  }
  return null
}

// Resolves a shared game to a PGN: callback proxy first (instant, needs no username), then the
// archives of the players named in the share text, then of the user's own saved username.
export async function fetchSharedGamePgn(
  shared: SharedGame,
  knownUsername: string | null,
): Promise<string | null> {
  const viaCallback = await fetchViaCallbackProxy(shared)
  if (viaCallback) return viaCallback

  const candidates = [...shared.usernames, knownUsername ?? '']
    .map(u => u.trim())
    .filter((u, i, all) => u && all.findIndex(o => o.toLowerCase() === u.toLowerCase()) === i)
  for (const username of candidates) {
    const pgn = await fetchViaArchive(shared.id, username)
    if (pgn) return pgn
  }
  return null
}
