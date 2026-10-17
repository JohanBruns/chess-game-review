// Crash-safe localStorage access. Reading or writing throws (SecurityError) when the browser
// blocks site storage — e.g. "block all cookies", some private/embedded contexts — and an
// unguarded read during render takes the whole app down to an empty #root. Callers treat a
// failed read as "nothing stored" and a failed write as a no-op.

// chess.com username typed into GamePicker (or passed as ?username=) — also used by App to
// auto-orient the board to the reviewed player's side.
export const USERNAME_KEY = 'chess-username'

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable — the value just won't persist across reloads
  }
}
