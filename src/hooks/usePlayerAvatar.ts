import { useEffect, useState } from 'react'

// chess.com profile pictures for the player bars and the summary's Players row, fetched from the
// public player endpoint (api.chess.com/pub/player/{username} → { avatar }). Results — including
// "no avatar" — are cached per username for the session so flipping the board or switching
// chapters never refetches. Placeholder names ('White'/'Black', '?') are skipped.
const cache = new Map<string, Promise<string | null>>()

function fetchAvatar(username: string): Promise<string | null> {
  const key = username.toLowerCase()
  let pending = cache.get(key)
  if (!pending) {
    pending = fetch(`https://api.chess.com/pub/player/${encodeURIComponent(key)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(j => (j && typeof j.avatar === 'string' ? (j.avatar as string) : null))
      .catch(() => null)
    cache.set(key, pending)
  }
  return pending
}

export function usePlayerAvatar(username: string | null | undefined): string | null {
  const [avatar, setAvatar] = useState<{ name: string; url: string | null } | null>(null)
  const valid = username != null && /^[A-Za-z0-9_-]{3,25}$/.test(username) && !/^(white|black)$/i.test(username)

  useEffect(() => {
    if (!valid) return
    let cancelled = false
    fetchAvatar(username).then(url => {
      if (!cancelled) setAvatar({ name: username, url })
    })
    return () => { cancelled = true }
  }, [username, valid])

  return valid && avatar?.name === username ? avatar.url : null
}
