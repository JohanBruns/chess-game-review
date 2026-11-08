// Service worker: keeps the app working offline and starting fast, and carries the chess.com
// share sheet's push notifications (docs/iphone.md). Registered by src/main.tsx in production
// builds (and by the share setup in Settings).
//
// Caching (one runtime cache, filled as files are used):
// - page loads: network first, the cached page when offline — so a deploy is picked up at once
// - Vite's hashed build files (/assets/…) and the engine, pieces, boards, marks and sounds: cache
//   first. The build files never change under a name; the others are fixed assets (the engine
//   alone is 7 MB, not something to re-download in the background on every start). Replacing one
//   of those in public/ means bumping RUNTIME_CACHE below.
// - the manifest and small icons: from cache, refreshed in the background
// - everything else (the /api functions, chess.com's API, other sites) goes straight to the network
//
// Share push: a push (api/share-push.ts) parks the shared game in Cache Storage and shows a
// notification; tapping it brings up the app, which picks the game up with takePendingShare in
// src/lib/sharePush.ts. Parking it rather than passing it in the opened URL means the app gets the
// game however it comes to the front, even from its icon if the notification was missed.
const PENDING_CACHE = 'share-push-pending'
const PENDING_REQUEST = '/share-push-pending'
const RUNTIME_CACHE = 'gr-runtime-v1'
const SHELL_URL = '/'
const FIXED_PREFIXES = ['/assets/', '/engine/', '/pieces/', '/marks/', '/themes/', '/sounds/']
const REFRESHED_PREFIXES = ['/pwa/']
const REFRESHED_FILES = ['/favicon.svg', '/icons.svg', '/chess-coach.png', '/manifest.webmanifest']

self.addEventListener('install', event => {
  // The page itself, so even the first offline start finds something. Best effort.
  event.waitUntil(
    caches.open(RUNTIME_CACHE).then(cache => cache.add(SHELL_URL)).catch(() => {}).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Drop caches of older versions of this worker; never the parked shared game.
    for (const key of await caches.keys()) {
      if (key !== RUNTIME_CACHE && key !== PENDING_CACHE) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
  } else if (FIXED_PREFIXES.some(p => url.pathname.startsWith(p))) {
    event.respondWith(cacheFirst(request))
  } else if (REFRESHED_PREFIXES.some(p => url.pathname.startsWith(p)) || REFRESHED_FILES.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})

async function networkFirstPage(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  try {
    const response = await fetch(request)
    // Every page of this single-page app is the same index.html.
    if (response.ok) await cache.put(SHELL_URL, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(SHELL_URL)
    if (cached) return cached
    throw err
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(RUNTIME_CACHE)
  const cached = await cache.match(request)
  const refresh = fetch(request).then(async response => {
    if (response.ok) await cache.put(request, response.clone())
    return response
  })
  if (cached) {
    event.waitUntil(refresh.catch(() => {}))
    return cached
  }
  return refresh
}

self.addEventListener('push', event => {
  event.waitUntil(handlePush(event))
})

async function handlePush(event) {
  let data = {}
  try {
    data = event.data.json()
  } catch {
    // Still show something: iOS revokes the subscription after pushes that show no notification.
  }
  if (typeof data.text === 'string') {
    try {
      const cache = await caches.open(PENDING_CACHE)
      await cache.put(PENDING_REQUEST, new Response(JSON.stringify({ text: data.text, savedAt: Date.now() })))
    } catch {
      // The notification still opens the app; the game just has to be loaded by hand.
    }
  }
  await self.registration.showNotification(data.title || 'Game Review', {
    body: data.body || 'Tap to open Game Review.',
    icon: '/pwa/icon-192.png',
    tag: 'share-push',
  })
}

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(openApp())
})

async function openApp() {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (windows.length > 0) {
    // Already visible means no visibilitychange in the app, so tell it directly.
    windows[0].postMessage({ type: 'share-push-pending' })
    try {
      await windows[0].focus()
      return
    } catch {
      // Not allowed to focus it: open a window instead.
    }
  }
  await self.clients.openWindow('/')
}
