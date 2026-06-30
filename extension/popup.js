const btn = document.getElementById('btn')
const status = document.getElementById('status')
const urlInput = document.getElementById('url-input')
const userInput = document.getElementById('user-input')

// Persist settings via localStorage
const savedUrl = localStorage.getItem('chess-analyzer-url')
if (savedUrl) urlInput.value = savedUrl
urlInput.addEventListener('change', () => {
  localStorage.setItem('chess-analyzer-url', urlInput.value)
})

const savedUser = localStorage.getItem('chess-analyzer-username')
if (savedUser) userInput.value = savedUser
userInput.addEventListener('change', () => {
  localStorage.setItem('chess-analyzer-username', userInput.value)
})

btn.addEventListener('click', async () => {
  btn.disabled = true
  status.className = ''
  status.textContent = 'PGN wird extrahiert…'

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url?.includes('chess.com')) {
    status.className = 'error'
    status.textContent = 'Keine chess.com-Spielseite gefunden.'
    btn.disabled = false
    return
  }

  try {
    // Inject content script on demand — handles tabs that were already open
    // before the extension was installed or last reloaded.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
    } catch (_) { /* already injected or no permission — try sending anyway */ }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_PGN',
      username: userInput.value.trim() || null,
    })
    const pgn = response?.pgn

    if (!pgn) {
      status.className = 'error'
      status.textContent = 'PGN nicht gefunden. Seite vollständig laden und nochmal versuchen.'
      btn.disabled = false
      return
    }

    const baseUrl = (urlInput.value || 'https://chess-game-review-drab.vercel.app').replace(/\/$/, '')
    const url = `${baseUrl}/?pgn=${encodeURIComponent(pgn)}`

    // URL-Längenlimit (~8000 Zeichen); bei Überschreitung Warnung
    if (url.length > 8000) {
      status.className = 'error'
      status.textContent = `PGN zu lang für URL (${url.length} Zeichen). Bitte PGN manuell kopieren.`
      btn.disabled = false
      return
    }

    await chrome.tabs.create({ url })
    status.textContent = 'Analyse-Tab geöffnet ✓'
  } catch (e) {
    status.className = 'error'
    status.textContent = `Fehler: ${e.message ?? e}`
  }

  btn.disabled = false
})
