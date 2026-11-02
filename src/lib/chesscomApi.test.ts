import { describe, it, expect, afterEach, vi } from 'vitest'
// Lives here, not next to the function: every file under api/ is deployed as its own Vercel function.
import { GET } from '../../api/chesscom-game.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const call = (query: string) => GET(new Request(`https://example.test/api/chesscom-game?${query}`))

describe('GET /api/chesscom-game', () => {
  it('rejects a non-numeric id without calling chess.com', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await call('id=../../evil')).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back from live to daily and caches a finished game', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes('/live/')) return new Response('{}', { status: 404 })
      return new Response(JSON.stringify({ game: { moveList: 'mC0K', isFinished: true } }))
    }))
    const res = await call('id=185820408402')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ game: { moveList: 'mC0K', isFinished: true } })
    expect(res.headers.get('Cache-Control')).toContain('s-maxage')
    expect(urls).toEqual([
      'https://www.chess.com/callback/live/game/185820408402',
      'https://www.chess.com/callback/daily/game/185820408402',
    ])
  })

  it('honours an explicit type and never caches a running game', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ game: { moveList: 'mC', isFinished: false } })))
    vi.stubGlobal('fetch', fetchMock)
    const res = await call('id=1&type=daily')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('answers 404 when chess.com has no such game', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    expect((await call('id=42')).status).toBe(404)
  })
})
