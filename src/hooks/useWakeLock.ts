import { useEffect } from 'react'

// Keeps the screen on while `active` (the whole-game analysis): a phone that locks itself halfway
// through suspends the page, and the engine workers with it. The browser drops the lock whenever
// the page is hidden, so it is asked for again when the page comes back. Where the Screen Wake
// Lock API is missing or refuses, nothing happens — the analysis just runs as before.
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    function request() {
      if (document.visibilityState !== 'visible') return
      navigator.wakeLock.request('screen').then(
        lock => {
          if (cancelled) lock.release().catch(() => {})
          else sentinel = lock
        },
        () => {},
      )
    }
    function handleVisibility() {
      if (sentinel == null || sentinel.released) request()
    }

    request()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      sentinel?.release().catch(() => {})
    }
  }, [active])
}
