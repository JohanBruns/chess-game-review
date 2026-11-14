const btn = document.getElementById('btn')
const status = document.getElementById('status')
const urlInput = document.getElementById('url-input')
const userInput = document.getElementById('user-input')
const settings = globalThis.chessAnalyzerSettings

// Settings live in chrome.storage.sync so the in-page button (content.js) sees them too.
// One-time migration from the popup's old localStorage keys.
async function initSettings() {
  const legacyUrl = localStorage.getItem('chess-analyzer-url')
  const legacyUser = localStorage.getItem('chess-analyzer-username')
  if (legacyUrl !== null || legacyUser !== null) {
    await settings.save({
      ...(legacyUrl !== null ? { appUrl: legacyUrl } : {}),
      ...(legacyUser !== null ? { username: legacyUser } : {}),
    })
    localStorage.removeItem('chess-analyzer-url')
    localStorage.removeItem('chess-analyzer-username')
  }
  const { appUrl, username } = await settings.load()
  urlInput.value = appUrl
  userInput.value = username
}
initSettings()

urlInput.addEventListener('change', () => settings.save({ appUrl: urlInput.value.trim() }))
userInput.addEventListener('change', () => settings.save({ username: userInput.value.trim() }))

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
    // Inject on demand — handles tabs opened before the extension was installed or reloaded.
    // content.js guards against running twice.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['settings.js', 'content.js'],
      })
    } catch (_) { /* no permission — try sending anyway */ }

    const result = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_ANALYSIS_URL',
      settings: { appUrl: urlInput.value.trim(), username: userInput.value.trim() },
    })

    if (!result?.url) {
      status.className = 'error'
      status.textContent = result?.error ?? 'Unbekannter Fehler.'
      btn.disabled = false
      return
    }

    await chrome.tabs.create({ url: result.url })
    status.textContent = result.notice ?? 'Analyse-Tab geöffnet ✓'
  } catch (e) {
    status.className = 'error'
    status.textContent = `Fehler: ${e.message ?? e}`
  }

  btn.disabled = false
})
