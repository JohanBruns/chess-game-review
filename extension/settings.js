// Shared by popup.js and content.js: App-URL + chess.com username, stored in chrome.storage.sync
// so the content script (which can't see the popup's localStorage) reads the same values.

globalThis.chessAnalyzerSettings ??= (() => {
  const DEFAULT_APP_URL = 'https://chess-game-review-drab.vercel.app'
  const DEFAULTS = { appUrl: DEFAULT_APP_URL, username: '' }

  async function load() {
    try {
      const stored = await chrome.storage.sync.get(DEFAULTS)
      return { appUrl: stored.appUrl || DEFAULT_APP_URL, username: stored.username || '' }
    } catch (_) {
      return { ...DEFAULTS }
    }
  }

  async function save(partial) {
    try {
      await chrome.storage.sync.set(partial)
    } catch (_) { /* storage unavailable — keep working with in-memory values */ }
  }

  return { DEFAULT_APP_URL, load, save }
})()
