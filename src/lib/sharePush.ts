// App side of the chess.com share sheet: iOS can't open a Home Screen web app from a Shortcut, only
// from a tap on a web push notification (docs/iphone.md). This sets up the push subscription and
// the link for the Shortcut, and picks up the game public/sw.js parked when the push came in.
import { readStorage, writeStorage, removeStorage } from './storage'

const TOKEN_KEY = 'share-push-token'
const PENDING_CACHE = 'share-push-pending'
const PENDING_REQUEST = '/share-push-pending'
// Same as the push's TTL in api/share-push.ts: an older game was probably not meant any more.
const PENDING_MAX_AGE_MS = 15 * 60 * 1000

// 'needs-install': iOS only offers push to apps opened from the Home Screen.
export type SharePushState = 'unsupported' | 'needs-install' | 'off' | 'on'

export type EnableResult = { ok: true } | { ok: false; reason: 'denied' | 'failed' }

export interface ShareTokenParts {
  endpoint: string
  p256dh: string
  auth: string
  vapidPublicKey: string
  vapidPrivateKey: string
}

function base64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

export function encodeShareToken(parts: ShareTokenParts): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(parts)).buffer as ArrayBuffer)
}

// A key pair per install, made here rather than kept on the server: the repo is public, and this
// way the server needs no secret and no database. See api/share-push.ts.
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return {
    publicKey: base64Url(await crypto.subtle.exportKey('raw', pair.publicKey)),
    privateKey: jwk.d!,
  }
}

function hasPushApis(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

export async function readSharePushState(): Promise<SharePushState> {
  if (/iPhone|iPad/.test(navigator.userAgent) && !isStandalone()) return 'needs-install'
  if (!hasPushApis()) return 'unsupported'
  try {
    return readStorage(TOKEN_KEY) && (await currentSubscription()) ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

// Must run directly from a tap: iOS only shows the permission prompt inside a user gesture.
export async function enableSharePush(): Promise<EnableResult> {
  if ((await Notification.requestPermission()) !== 'granted') return { ok: false, reason: 'denied' }
  try {
    await navigator.serviceWorker.register('/sw.js')
    const registration = await navigator.serviceWorker.ready
    // A subscription is tied to its key, so a leftover one can't be reused with a new key pair.
    await (await registration.pushManager.getSubscription())?.unsubscribe()
    const keys = await generateVapidKeys()
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: fromBase64Url(keys.publicKey),
    })
    const json = subscription.toJSON()
    writeStorage(TOKEN_KEY, encodeShareToken({
      endpoint: subscription.endpoint,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
      vapidPublicKey: keys.publicKey,
      vapidPrivateKey: keys.privateKey,
    }))
    return { ok: true }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

export async function disableSharePush(): Promise<void> {
  removeStorage(TOKEN_KEY)
  try {
    await (await currentSubscription())?.unsubscribe()
  } catch {
    // Forgetting the token already stops it being used from here.
  }
}

// The Shortcut's Text action: this, directly followed by the URL-encoded share text.
export function shareLink(): string | null {
  const token = readStorage(TOKEN_KEY)
  return token ? `${window.location.origin}/api/share-push?token=${token}&share=` : null
}

export type TestResult = 'sent' | 'expired' | 'failed'

export async function sendTestNotification(): Promise<TestResult> {
  const token = readStorage(TOKEN_KEY)
  try {
    const res = await fetch(`/api/share-push?token=${token}&test=1`)
    if (res.ok) return 'sent'
    return res.status === 410 ? 'expired' : 'failed'
  } catch {
    return 'failed'
  }
}

// The game a push parked, once: public/sw.js writes it, and the app reads it whenever it comes to
// the front. The delete decides who gets it, so two checks at once can't load it twice.
export async function takePendingShare(): Promise<string | null> {
  if (typeof caches === 'undefined') return null
  try {
    if (!(await caches.has(PENDING_CACHE))) return null
    const cache = await caches.open(PENDING_CACHE)
    const response = await cache.match(PENDING_REQUEST)
    if (!response) return null
    const { text, savedAt } = await response.json() as { text?: unknown; savedAt?: unknown }
    if (!(await cache.delete(PENDING_REQUEST))) return null
    const fresh = typeof savedAt === 'number' && Date.now() - savedAt < PENDING_MAX_AGE_MS
    return fresh && typeof text === 'string' ? text : null
  } catch {
    return null
  }
}
