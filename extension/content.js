// Injected into every chess.com page (chess.com switches /play/online → /game/… client-side,
// without a page load, so matching only /game/* would miss games played in the same tab).
// - Extracts the PGN of the game on screen (several strategies, see extractPgn)
// - Puts a "Partie analysieren" button into the game-over modal and under the move list
// - Answers the popup's GET_ANALYSIS_URL message
// Wrapped in a guard because popup.js re-injects it into already-open tabs.
;(() => {
if (globalThis.__chessAnalyzerContentLoaded) return
globalThis.__chessAnalyzerContentLoaded = true

// /game/123, /game/live/123, /game/daily/123, /live/game/123, /analysis/game/live/123 …
const GAME_PATH = /\/(?:(live|daily)\/)?game\/(?:(live|daily|chess960)\/)?(\d+)/

function parseGamePath(pathname = location.pathname) {
  const m = pathname.match(GAME_PATH)
  if (!m) return null
  return { gameType: m[2] ?? m[1] ?? 'live', gameId: m[3] }
}

// A game in progress also lives under /game/{id}. Running engine analysis on it would break
// chess.com's fair-play rules, so nothing is offered while its resign/draw/abort controls show.
const ONGOING_GAME_CONTROLS =
  '.resign-button-component, .draw-button-component, .abort-button-component, [aria-label="Resign"]'

function isGameInProgress() {
  return document.querySelector(ONGOING_GAME_CONTROLS) !== null
}

// Username: provided by popup/settings > URL query param > page DOM
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
  const game = parseGamePath()
  if (!game) return null
  const { gameType, gameId } = game

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

// ---------------------------------------------------------------------------
// Analysis URL (shared by popup and in-page buttons)
// ---------------------------------------------------------------------------

const MAX_URL_LENGTH = 8000

// → { url, notice? } on success, { error } otherwise
async function buildAnalysisUrl({ appUrl, username } = {}) {
  if (!parseGamePath()) {
    return { error: 'Keine chess.com-Partie auf dieser Seite gefunden.' }
  }
  if (isGameInProgress()) {
    return { error: 'Die Partie läuft noch — Analyse erst nach Spielende.' }
  }
  const baseUrl = (appUrl || globalThis.chessAnalyzerSettings?.DEFAULT_APP_URL || '').replace(/\/$/, '')
  const pgn = await extractPgn(username || null)
  const resolvedUser = resolveUsername(username || null)

  if (!pgn) {
    const url = resolvedUser
      ? `${baseUrl}/?username=${encodeURIComponent(resolvedUser)}&autofetch=1`
      : baseUrl
    return {
      url,
      notice: resolvedUser
        ? `PGN nicht gefunden — App geöffnet, bitte Partie für "${resolvedUser}" auswählen ✓`
        : 'PGN nicht gefunden — App geöffnet, bitte Partie auswählen ✓',
    }
  }

  let url = `${baseUrl}/?pgn=${encodeURIComponent(pgn)}`
  // Long games: drop the {[%clk …]} comments before giving up
  if (url.length > MAX_URL_LENGTH) {
    url = `${baseUrl}/?pgn=${encodeURIComponent(pgn.replace(/\s*\{[^}]*\}/g, ''))}`
  }
  if (url.length > MAX_URL_LENGTH) {
    return { error: `PGN zu lang für URL (${url.length} Zeichen). Bitte PGN manuell kopieren.` }
  }
  return { url }
}

async function loadSettings() {
  return globalThis.chessAnalyzerSettings?.load() ?? {}
}

// ---------------------------------------------------------------------------
// In-page buttons
// ---------------------------------------------------------------------------

const STYLE_ID = 'cea-styles'
const MODAL_SLOT = '.game-over-coach-speech-slot-component'
const SIDEBAR_ANCHOR = '.game-buttons-container-component'

const CSS = `
/* Replace the coach bubble only once our button is in the slot — if injection ever fails,
   chess.com's own content stays visible. */
${MODAL_SLOT}:has(> .cea-modal-slot) > :not(.cea-modal-slot) { display: none !important; }
.cea-modal-slot { display: flex; flex-direction: column; justify-content: center;
  width: 100%; box-sizing: border-box; padding: 8px 0; }
.cea-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
  box-sizing: border-box; border: none; border-radius: 8px; cursor: pointer;
  font-family: inherit; font-weight: 800; color: #e8eef7; background: #4a6584;
  box-shadow: 0 4px 0 #36495f; transition: background .12s, transform .05s, box-shadow .05s; }
.cea-btn:hover { background: #56739a; }
.cea-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #36495f; }
.cea-btn[disabled] { opacity: .7; cursor: progress; }
.cea-btn-modal { min-height: 56px; font-size: 20px; padding: 10px 16px; }
.cea-btn-sidebar { min-height: 40px; font-size: 15px; padding: 6px 12px; }
.cea-btn-sub { display: block; font-size: 12px; font-weight: 600; opacity: .8; }
.cea-msg { margin-top: 6px; font-size: 12px; line-height: 1.3; color: #f87171; text-align: center; }
.cea-msg:empty { display: none; }
.cea-sidebar { padding: 8px 12px 4px; }
`

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  ;(document.head || document.documentElement).appendChild(style)
}

const ICON = '♞'

function createButton(variant) {
  const wrapper = document.createElement('div')
  wrapper.className = variant === 'modal' ? 'cea-modal-slot' : 'cea-sidebar'

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = `cea-btn cea-btn-${variant}`
  const label = document.createElement('span')
  label.textContent = `${ICON} Partie analysieren`
  btn.appendChild(label)
  btn.title = 'Partie in Chess Analyzer öffnen'

  const msg = document.createElement('div')
  msg.className = 'cea-msg'

  btn.addEventListener('click', async (event) => {
    event.preventDefault()
    event.stopPropagation()
    btn.disabled = true
    msg.textContent = ''
    label.textContent = 'PGN wird geladen…'
    try {
      const result = await buildAnalysisUrl(await loadSettings())
      if (!result.url) {
        msg.textContent = result.error
        return
      }
      await chrome.runtime.sendMessage({ type: 'OPEN_ANALYSIS_TAB', url: result.url })
      if (result.notice) msg.textContent = result.notice
    } catch (e) {
      // After reloading the extension, old content scripts lose their connection to it.
      msg.textContent = /context invalidated/i.test(String(e?.message ?? e))
        ? 'Extension wurde neu geladen — bitte Seite neu laden.'
        : `Fehler: ${e?.message ?? e}`
    } finally {
      btn.disabled = false
      label.textContent = `${ICON} Partie analysieren`
    }
  })

  wrapper.append(btn, msg)
  return wrapper
}

function ensureModalButton() {
  const slot = document.querySelector(MODAL_SLOT)
  if (!slot || isGameInProgress() || slot.querySelector(':scope > .cea-modal-slot')) return
  slot.appendChild(createButton('modal'))
}

function ensureSidebarButton() {
  const existing = document.querySelector('.cea-sidebar')
  const anchor = document.querySelector(SIDEBAR_ANCHOR)
  // Only on finished/viewed games, never while the game is still being played.
  if (!parseGamePath() || !anchor || isGameInProgress()) {
    existing?.remove()
    return
  }
  if (existing && existing.nextElementSibling === anchor) return
  existing?.remove()
  anchor.parentElement.insertBefore(createButton('sidebar'), anchor)
}

function refreshButtons() {
  try {
    ensureStyles()
    ensureModalButton()
    ensureSidebarButton()
  } catch (_) { /* never break chess.com's page */ }
}

// chess.com is a SPA that re-renders constantly (clocks, move list) — coalesce mutations.
let refreshQueued = false
function scheduleRefresh() {
  if (refreshQueued) return
  refreshQueued = true
  setTimeout(() => {
    refreshQueued = false
    refreshButtons()
  }, 150)
}

new MutationObserver(scheduleRefresh).observe(document.documentElement, {
  childList: true,
  subtree: true,
})
refreshButtons()

// ---------------------------------------------------------------------------
// Popup messages
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'GET_ANALYSIS_URL') return
  ;(async () => {
    const stored = await loadSettings()
    const settings = {
      appUrl: msg.settings?.appUrl || stored.appUrl,
      username: msg.settings?.username || stored.username,
    }
    return buildAnalysisUrl(settings)
  })()
    .then(sendResponse)
    .catch((e) => sendResponse({ error: `Fehler: ${e?.message ?? e}` }))
  return true // keep channel open for async response
})
})()
