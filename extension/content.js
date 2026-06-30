// Injected into chess.com/game/* pages.
// Tries multiple strategies to extract PGN, then exposes it via a custom event.

async function extractPgn() {
  // Strategy 1: Check Next.js server-side data (works on many chess.com pages)
  try {
    const nextDataEl = document.getElementById('__NEXT_DATA__')
    if (nextDataEl) {
      const data = JSON.parse(nextDataEl.textContent || '{}')
      // Path varies by page type; try common locations
      const pgn =
        data?.props?.pageProps?.game?.pgn ||
        data?.props?.pageProps?.gameData?.pgn ||
        data?.props?.pageProps?.gamePgn
      if (pgn && typeof pgn === 'string' && pgn.trim().length > 0) {
        return pgn.trim()
      }
    }
  } catch (_) { /* continue */ }

  // Strategy 2: Unofficial callback API (game ID from URL)
  // URL patterns: /game/live/12345, /game/daily/12345, /game/chess960/12345
  const urlMatch = location.pathname.match(/\/game\/(live|daily|chess960)\/(\d+)/)
  if (urlMatch) {
    const [, gameType, gameId] = urlMatch
    try {
      const res = await fetch(`https://www.chess.com/callback/${gameType}/game/${gameId}`, {
        credentials: 'include', // send cookies so auth works
      })
      if (res.ok) {
        const json = await res.json()
        // Try known response shapes
        const pgn =
          json?.game?.pgn ||
          json?.pgn ||
          json?.game?.pgnHeaders // last resort: just headers, no moves
        if (pgn && typeof pgn === 'string' && pgn.trim().length > 0) {
          return pgn.trim()
        }
      }
    } catch (_) { /* continue */ }
  }

  // Strategy 3: Official public API (username + month required — skipped here,
  // needs user input; better handled via the app UI directly)

  return null
}

// Listen for message from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'GET_PGN') return
  extractPgn().then(pgn => sendResponse({ pgn }))
  return true // keep channel open for async response
})
