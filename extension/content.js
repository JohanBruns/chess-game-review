// Injected into chess.com/game/* pages.
// Tries multiple strategies to extract PGN.

// Username: provided by popup > URL query param > page DOM
function resolveUsername(providedUsername = null) {
  return (
    providedUsername ||
    new URLSearchParams(location.search).get('username') ||
    document.querySelector('[data-username]')?.dataset?.username ||
    document.querySelector('.user-username-component')?.textContent?.trim() ||
    null
  )
}

async function extractPgn(providedUsername = null) {
  const urlMatch = location.pathname.match(/\/game\/(?:(live|daily|chess960)\/)?(\d+)/)
  if (!urlMatch) return null
  const gameType = urlMatch[1] ?? 'live'
  const gameId = urlMatch[2]

  const username = resolveUsername(providedUsername)

  // Strategy 1: Unofficial callback API — available the instant the game ends and is exactly
  // the game on screen (the official monthly archive can lag several minutes behind).
  const pgn1 = await fetchFromCallbackApi(gameType, gameId)
  if (pgn1) return pgn1

  // Strategy 2: Official public API — requires username, returns full PGN
  if (username) {
    const pgn = await fetchFromOfficialApi(username, gameId)
    if (pgn) return pgn
  }

  // Strategy 3: __NEXT_DATA__ (Next.js SSR data in page source)
  return extractFromNextData()
}

// Official: https://api.chess.com/pub/player/{username}/games/{year}/{month}
// Tries current month and the two previous months (covers games near month boundaries).
async function fetchFromOfficialApi(username, gameId) {
  const now = new Date()
  const months = [
    { year: now.getFullYear(), month: now.getMonth() + 1 },
    { year: now.getFullYear(), month: now.getMonth() },     // previous month
    { year: now.getFullYear(), month: now.getMonth() - 1 }, // two months ago
  ].map(({ year, month }) => {
    // Wrap December → January etc.
    if (month <= 0) { month += 12; year -= 1 }
    return { year, month: String(month).padStart(2, '0') }
  })

  for (const { year, month } of months) {
    try {
      const url = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`
      const res = await fetch(url)
      if (!res.ok) continue
      const json = await res.json()
      const games = json?.games ?? []
      // Match by game ID in the game's URL field
      const game = games.find(g => g?.url?.includes(gameId))
      if (game?.pgn) return game.pgn
    } catch (_) { /* try next month */ }
  }
  return null
}

// Unofficial: https://www.chess.com/callback/{type}/game/{id}
async function fetchFromCallbackApi(gameType, gameId) {
  try {
    const res = await fetch(
      `https://www.chess.com/callback/${gameType}/game/${gameId}`,
      { credentials: 'include' },
    )
    if (!res.ok) return null
    const json = await res.json()
    const pgn = json?.game?.pgn || json?.pgn || buildPgnFromCallbackGame(json?.game)
    return typeof pgn === 'string' && pgn.length > 10 ? pgn : null
  } catch (_) {
    return null
  }
}

// The callback JSON has no PGN field — only `pgnHeaders`, the moves as a TCN-encoded
// `moveList` and `moveTimestamps` (remaining clock per ply, in tenths of a second).
// Rebuilds a PGN from those. Moves are written in coordinate notation (e2e4, e7e8q), which
// chess.js's lenient PGN parser in the app accepts and converts to SAN.
function buildPgnFromCallbackGame(game) {
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
  const tokens = []
  moves.forEach((move, i) => {
    if (i % 2 === 0) tokens.push(`${i / 2 + 1}.`)
    tokens.push(move)
    if (Number.isFinite(clocks[i])) tokens.push(`{[%clk ${formatClock(clocks[i])}]}`)
  })
  tokens.push(headers.Result || '*')

  return `${headerLines.join('\n')}\n\n${tokens.join(' ')}`
}

// chess.com's TCN: two chars per move, each char indexes a square (a1=0 … h8=63). A target
// char past 63 encodes a promotion: piece = (idx-64)/3, file offset = (idx-64)%3 - 1.
function decodeTcn(tcn) {
  var ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++='
  var PROMOTION_PIECES = 'qnrb'
  var square = (idx) => 'abcdefgh'[idx % 8] + (Math.floor(idx / 8) + 1)
  var moves = []
  for (var i = 0; i + 1 < tcn.length; i += 2) {
    var from = ALPHABET.indexOf(tcn[i])
    var to = ALPHABET.indexOf(tcn[i + 1])
    if (from < 0 || from > 63 || to < 0) return null // drop moves (variants) — unsupported
    var promotion = ''
    if (to > 63) {
      promotion = PROMOTION_PIECES[Math.floor((to - 64) / 3)]
      if (!promotion) return null
      to = from + (from < 16 ? -8 : 8) + ((to - 64) % 3) - 1
    }
    moves.push(square(from) + square(to) + promotion)
  }
  return moves
}

// Tenths of a second → chess.com's %clk format "H:MM:SS.t"
function formatClock(tenths) {
  var totalSeconds = tenths / 10
  var hours = Math.floor(totalSeconds / 3600)
  var minutes = Math.floor((totalSeconds % 3600) / 60)
  var seconds = (totalSeconds % 60).toFixed(1).padStart(4, '0')
  return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
}

// __NEXT_DATA__: Next.js bakes server data into a <script> tag
function extractFromNextData() {
  try {
    const el = document.getElementById('__NEXT_DATA__')
    if (!el) return null
    const data = JSON.parse(el.textContent || '{}')
    return (
      data?.props?.pageProps?.game?.pgn ||
      data?.props?.pageProps?.gameData?.pgn ||
      data?.props?.pageProps?.gamePgn ||
      null
    )
  } catch (_) {
    return null
  }
}

// Listen for message from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GET_PGN') return
  extractPgn(msg.username ?? null).then(pgn => {
    sendResponse({ pgn, username: resolveUsername(msg.username ?? null) })
  })
  return true // keep channel open for async response
})
