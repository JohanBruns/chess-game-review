// Injected into chess.com/game/* pages.
// Tries multiple strategies to extract PGN.

async function extractPgn(providedUsername = null) {
  const urlMatch = location.pathname.match(/\/game\/(?:(live|daily|chess960)\/)?(\d+)/)
  if (!urlMatch) return null
  const gameType = urlMatch[1] ?? 'live'
  const gameId = urlMatch[2]

  // Username: provided by popup > URL query param > page DOM
  const username =
    providedUsername ||
    new URLSearchParams(location.search).get('username') ||
    document.querySelector('[data-username]')?.dataset?.username ||
    document.querySelector('.user-username-component')?.textContent?.trim() ||
    null

  // Strategy 1: Official public API — requires username, returns full PGN
  if (username) {
    const pgn = await fetchFromOfficialApi(username, gameId)
    if (pgn) return pgn
  }

  // Strategy 2: Unofficial callback API — try common response shapes
  const pgn2 = await fetchFromCallbackApi(gameType, gameId)
  if (pgn2) return pgn2

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
    // Try every known field name
    const pgn = json?.game?.pgn || json?.pgn || null
    return typeof pgn === 'string' && pgn.length > 10 ? pgn : null
  } catch (_) {
    return null
  }
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
  extractPgn(msg.username ?? null).then(pgn => sendResponse({ pgn }))
  return true // keep channel open for async response
})
