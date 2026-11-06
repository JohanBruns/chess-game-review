// Service worker for the chess.com share sheet (docs/iphone.md). Only registered once the user
// turns this on in Settings. It does no caching and doesn't touch page requests.
//
// A push (api/share-push.ts) parks the shared game in Cache Storage and shows a notification;
// tapping it brings up the app, which picks the game up with takePendingShare in
// src/lib/sharePush.ts. Parking it rather than passing it in the opened URL means the app gets the
// game however it comes to the front, even from its icon if the notification was missed.
const PENDING_CACHE = 'share-push-pending'
const PENDING_REQUEST = '/share-push-pending'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

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
