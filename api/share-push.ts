// Vercel serverless function: GET /api/share-push?token=<token>&share=<chess.com share text>
//
// The iOS Shortcut in the chess.com share sheet calls this. iOS can't open a Home Screen web app
// from a Shortcut — only a tap on a web push notification can — so this sends one to the phone,
// and public/sw.js takes it from there (docs/iphone.md).
//
// Stateless on purpose: the token holds the push subscription and its VAPID key pair, both made on
// the phone by src/lib/sharePush.ts and kept in the user's Shortcut. Nothing is stored here, and
// no server secret is needed. A token can only ever reach the subscription inside it, and the
// endpoint allowlist keeps this from being used to send requests anywhere else.
// ?test=1 sends a test notification instead of a game (the Settings menu's test button).
import webpush from 'web-push'

interface ShareToken {
  endpoint: string
  p256dh: string
  auth: string
  vapidPublicKey: string
  vapidPrivateKey: string
}

const PUSH_HOST_RE = /^(?:web\.push\.apple\.com|fcm\.googleapis\.com|[\w.-]+\.push\.services\.mozilla\.com|[\w.-]+\.notify\.windows\.com)$/
// Same link shapes as src/lib/chesscom.ts, which a function can't import from here.
const GAME_LINK_RE = /chess\.com\/(?:[a-z]{2}\/)?(?:analysis\/)?game\/(?:(?:live|daily)\/)?\d+/i
const PLAYERS_RE = /([\w-]{3,25})\s+\S+\s+([\w-]{3,25})\s+-\s+https?:\/\//
const MAX_SHARE_LENGTH = 600
// How long the push service keeps trying. Matches how long public/sw.js keeps a game waiting.
const TTL_SECONDS = 15 * 60

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const token = decodeToken(url.searchParams.get('token') ?? '')
  if (!token) return json({ error: 'invalid token' }, 400)

  const isTest = url.searchParams.get('test') === '1'
  const text = (url.searchParams.get('share') ?? '').trim()
  if (!isTest && (text.length > MAX_SHARE_LENGTH || !GAME_LINK_RE.test(text))) {
    return json({ error: 'not a chess.com game link' }, 400)
  }

  try {
    await webpush.sendNotification(
      { endpoint: token.endpoint, keys: { p256dh: token.p256dh, auth: token.auth } },
      JSON.stringify(isTest ? testPayload() : gamePayload(text)),
      {
        TTL: TTL_SECONDS,
        urgency: 'high',
        vapidDetails: {
          subject: url.origin,
          publicKey: token.vapidPublicKey,
          privateKey: token.vapidPrivateKey,
        },
      },
    )
    return json({ ok: true }, 200)
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return json({ error: 'subscription expired' }, 410)
    return json({ error: 'push failed', status: status ?? null }, 502)
  }
}

function gamePayload(text: string) {
  const players = text.match(PLAYERS_RE)
  return {
    title: 'Game ready to analyze',
    body: players ? `${players[1]} vs ${players[2]}` : 'Tap to open Game Review.',
    text,
  }
}

function testPayload() {
  return { title: 'Game Review', body: 'Notifications work.' }
}

function decodeToken(raw: string): ShareToken | null {
  try {
    const t = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<ShareToken>
    const endpoint = new URL(t.endpoint ?? '')
    if (endpoint.protocol !== 'https:' || !PUSH_HOST_RE.test(endpoint.hostname)) return null
    // Sizes of a P-256 key and auth secret in base64url.
    if (!isKey(t.p256dh, 87) || !isKey(t.auth, 22) || !isKey(t.vapidPublicKey, 87) || !isKey(t.vapidPrivateKey, 43)) {
      return null
    }
    return t as ShareToken
  } catch {
    return null
  }
}

function isKey(value: unknown, length: number): boolean {
  return typeof value === 'string' && value.length === length && /^[\w-]+$/.test(value)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
