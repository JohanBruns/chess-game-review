const btn = document.getElementById('btn')
const status = document.getElementById('status')
const portInput = document.getElementById('port-input')

// Persist port setting
chrome.storage.local.get('port', ({ port }) => {
  if (port) portInput.value = port
})
portInput.addEventListener('change', () => {
  chrome.storage.local.set({ port: portInput.value })
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
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PGN' })
    const pgn = response?.pgn

    if (!pgn) {
      status.className = 'error'
      status.textContent = 'PGN nicht gefunden. Seite vollständig laden und nochmal versuchen.'
      btn.disabled = false
      return
    }

    const port = portInput.value || '5173'
    const url = `http://localhost:${port}/?pgn=${encodeURIComponent(pgn)}`

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
