import { readFileSync } from 'node:fs'
import { describe, it, expect, afterEach, vi } from 'vitest'
import webpush from 'web-push'
// Lives here, not next to the function: every file under api/ is deployed as its own Vercel function.
import { GET } from '../../api/share-push.ts'
import { parseSharedGame } from './chesscom'
import { encodeShareToken, generateVapidKeys, takePendingShare, type ShareTokenParts } from './sharePush'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const SHARE_TEXT = 'Schauen Sie sich dieses #Schachspiel an: xeoak gegen jojo2go - https://www.chess.com/game/185820408402'
const KEYS = { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22), vapidPublicKey: 'v'.repeat(87), vapidPrivateKey: 'k'.repeat(43) }
const parts = (endpoint = 'https://web.push.apple.com/abc'): ShareTokenParts => ({ endpoint, ...KEYS })

const call = (query: Record<string, string>) =>
  GET(new Request(`https://app.example/api/share-push?${new URLSearchParams(query)}`))

function stubPush() {
  return vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} })
}

describe('generateVapidKeys', () => {
  it('makes keys the push library accepts, with the sizes the endpoint expects', async () => {
    const { publicKey, privateKey } = await generateVapidKeys()
    expect(publicKey).toHaveLength(87)
    expect(privateKey).toHaveLength(43)
    const headers = webpush.getVapidHeaders('https://web.push.apple.com', 'https://app.example', publicKey, privateKey, 'aes128gcm')
    expect(headers.Authorization).toContain(publicKey)
  })
})

describe('GET /api/share-push', () => {
  it('sends the game to the subscription in the token, with the keys from the token', async () => {
    const send = stubPush()
    const res = await call({ token: encodeShareToken(parts()), share: SHARE_TEXT })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const [subscription, payload, options] = send.mock.calls[0]
    expect(subscription).toEqual({
      endpoint: 'https://web.push.apple.com/abc',
      keys: { p256dh: KEYS.p256dh, auth: KEYS.auth },
    })
    expect(JSON.parse(payload as string)).toEqual({
      title: 'Game ready to analyze',
      body: 'xeoak vs jojo2go',
      text: SHARE_TEXT,
    })
    expect(options?.vapidDetails).toEqual({
      subject: 'https://app.example',
      publicKey: KEYS.vapidPublicKey,
      privateKey: KEYS.vapidPrivateKey,
    })
  })

  it('accepts every link the app itself can load', async () => {
    stubPush()
    const links = [
      'https://www.chess.com/game/live/123456789',
      'https://www.chess.com/de/game/daily/987654321?move=4',
      'https://www.chess.com/analysis/game/live/111222333',
    ]
    for (const share of links) {
      expect(parseSharedGame(share)).not.toBeNull()
      expect((await call({ token: encodeShareToken(parts()), share })).status).toBe(200)
    }
  })

  it('never contacts a host outside the push services', async () => {
    const send = stubPush()
    for (const endpoint of ['https://evil.example/x', 'http://web.push.apple.com/x', 'https://web.push.apple.com.evil.example/x']) {
      expect((await call({ token: encodeShareToken(parts(endpoint)), share: SHARE_TEXT })).status).toBe(400)
    }
    expect(send).not.toHaveBeenCalled()
  })

  it('rejects broken tokens and anything that is not a game', async () => {
    const send = stubPush()
    const token = encodeShareToken(parts())
    expect((await call({ token: 'nonsense', share: SHARE_TEXT })).status).toBe(400)
    expect((await call({ token: encodeShareToken({ ...parts(), auth: 'short' }), share: SHARE_TEXT })).status).toBe(400)
    expect((await call({ token, share: 'https://lichess.org/abcdef' })).status).toBe(400)
    expect((await call({ token })).status).toBe(400)
    expect((await call({ token, share: `${SHARE_TEXT} ${'x'.repeat(600)}` })).status).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })

  it('ignores characters added to a token on its way into the Shortcut', async () => {
    const send = stubPush()
    const token = encodeShareToken(parts())
    expect(token).toMatch(/^[A-Za-z0-9]+$/)
    const everyTen = (added: string) => token.replace(/(.{10})/g, `$1${added}`)
    for (const damaged of [everyTen('-'), everyTen('­'), everyTen('‐'), everyTen(' '), everyTen('\n')]) {
      expect((await call({ token: damaged, share: SHARE_TEXT })).status).toBe(200)
    }
    expect(send).toHaveBeenCalledTimes(5)
    expect(send.mock.calls[4][0]).toEqual(send.mock.calls[0][0])
  })

  it('still reads a token whose own characters include - and _', async () => {
    const send = stubPush()
    const token = encodeShareToken(parts('https://abc.notify.windows.com/w/?token=x~y>z??'))
    expect(token).toMatch(/[-_]/)
    expect((await call({ token, share: SHARE_TEXT })).status).toBe(200)
    expect(send).toHaveBeenCalledOnce()
  })

  it('says how a token is damaged, without echoing any of it', async () => {
    const send = stubPush()
    const token = encodeShareToken(parts())
    const shared = encodeURIComponent(SHARE_TEXT)

    const inserted = await call({ token: `${token.slice(0, 40)}${shared}${token.slice(40)}`, share: '' })
    const body = await inserted.text()
    expect(inserted.status).toBe(400)
    expect(JSON.parse(body)).toMatchObject({ error: 'invalid token', problem: 'unreadable' })
    expect(JSON.parse(body).received.otherCharacters).toBeGreaterThan(0)
    expect(JSON.parse(body).received.kinds).toContain('U+0025')
    expect(body).not.toContain(token.slice(0, 40))

    const cut = await (await call({ token: token.slice(0, 100), share: SHARE_TEXT })).json()
    expect(cut).toMatchObject({ problem: 'unreadable', received: { length: 100, otherCharacters: 0, kinds: [] } })

    const missingKey = await (await call({ token: encodeShareToken({ ...parts(), auth: 'short' }), share: SHARE_TEXT })).json()
    expect(missingKey.problem).toBe('keys')
    const wrongHost = await (await call({ token: encodeShareToken(parts('https://evil.example/x')), share: SHARE_TEXT })).json()
    expect(wrongHost.problem).toBe('endpoint')
    expect(send).not.toHaveBeenCalled()
  })

  it('sends a test notification without a game', async () => {
    const send = stubPush()
    expect((await call({ token: encodeShareToken(parts()), test: '1' })).status).toBe(200)
    expect(JSON.parse(send.mock.calls[0][1] as string).text).toBeUndefined()
  })

  it('tells an expired subscription apart from other failures', async () => {
    const spy = vi.spyOn(webpush, 'sendNotification')
    const token = encodeShareToken(parts())
    spy.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 }))
    expect((await call({ token, share: SHARE_TEXT })).status).toBe(410)
    spy.mockRejectedValueOnce(Object.assign(new Error('nope'), { statusCode: 403 }))
    expect((await call({ token, share: SHARE_TEXT })).status).toBe(502)
  })
})

// public/sw.js and takePendingShare share a cache: run the real worker against a fake browser.
function loadServiceWorker(existingWindows: { postMessage: () => void; focus: () => Promise<unknown> }[] = []) {
  const stores = new Map<string, Map<string, Response>>()
  const fakeCaches = {
    has: async (name: string) => stores.has(name),
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, Response>()
      stores.set(name, store)
      return {
        put: async (key: string, res: Response) => { store.set(key, res) },
        match: async (key: string) => store.get(key)?.clone(),
        delete: async (key: string) => store.delete(key),
      }
    },
  }
  vi.stubGlobal('caches', fakeCaches)

  const handlers: Record<string, (event: unknown) => void> = {}
  const showNotification = vi.fn(async () => {})
  const openWindow = vi.fn(async () => {})
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler },
    registration: { showNotification },
    clients: { matchAll: async () => existingWindows, openWindow, claim: async () => {} },
    skipWaiting: () => {},
  }
  new Function('self', readFileSync('public/sw.js', 'utf8'))(self)

  const dispatch = async (type: string, event: object) => {
    const pending: Promise<unknown>[] = []
    handlers[type]({ ...event, waitUntil: (p: Promise<unknown>) => pending.push(p) })
    await Promise.all(pending)
  }
  const push = (data: unknown) => dispatch('push', { data: { json: () => data } })
  const click = () => dispatch('notificationclick', { notification: { close: () => {} } })
  return { handlers, push, click, showNotification, openWindow }
}

describe('service worker and takePendingShare', () => {
  it('hands a pushed game to the app once, whichever way the app comes up', async () => {
    const { push, showNotification } = loadServiceWorker()
    await push({ title: 'Game ready to analyze', body: 'xeoak vs jojo2go', text: SHARE_TEXT })
    expect(showNotification).toHaveBeenCalledWith('Game ready to analyze', expect.objectContaining({ body: 'xeoak vs jojo2go' }))

    const [first, second] = await Promise.all([takePendingShare(), takePendingShare()])
    expect([first, second].filter(Boolean)).toEqual([SHARE_TEXT])
    expect(await takePendingShare()).toBeNull()
  })

  it('drops a game that has been waiting too long', async () => {
    const { push } = loadServiceWorker()
    vi.useFakeTimers({ toFake: ['Date'] })
    await push({ text: SHARE_TEXT })
    vi.setSystemTime(Date.now() + 16 * 60 * 1000)
    expect(await takePendingShare()).toBeNull()
  })

  it('always shows a notification, even for a push it cannot read', async () => {
    const { handlers, showNotification } = loadServiceWorker()
    const pending: Promise<unknown>[] = []
    handlers.push({ data: null, waitUntil: (p: Promise<unknown>) => pending.push(p) })
    await Promise.all(pending)
    expect(showNotification).toHaveBeenCalledTimes(1)
    expect(await takePendingShare()).toBeNull()
  })

  it('opens the app when it is not running', async () => {
    const { click, openWindow } = loadServiceWorker()
    await click()
    expect(openWindow).toHaveBeenCalledWith('/')
  })

  it('focuses and tells a running app instead of opening another', async () => {
    const running = { postMessage: vi.fn(), focus: vi.fn(async () => {}) }
    const { click, openWindow } = loadServiceWorker([running])
    await click()
    expect(running.postMessage).toHaveBeenCalledWith({ type: 'share-push-pending' })
    expect(running.focus).toHaveBeenCalled()
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('opens a window when a running app cannot be focused', async () => {
    const running = { postMessage: vi.fn(), focus: vi.fn(async () => { throw new Error('not allowed') }) }
    const { click, openWindow } = loadServiceWorker([running])
    await click()
    expect(openWindow).toHaveBeenCalledWith('/')
  })
})
