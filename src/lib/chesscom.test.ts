import { describe, it, expect, afterEach, vi } from 'vitest'
import { Chess } from 'chess.js'
import {
  parseSharedGame,
  containsGame,
  decodeTcn,
  buildPgnFromCallbackGame,
  fetchSharedGamePgn,
  fetchRecentGames,
  chessComGameId,
} from './chesscom'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chessComGameId', () => {
  it('reads the game id off the Link header', () => {
    expect(chessComGameId('[Event "Live Chess"]\n[Link "https://www.chess.com/game/live/186365372722"]\n\n1. d4 d5 *'))
      .toBe('186365372722')
    expect(chessComGameId('[Link "https://www.chess.com/game/daily/987654321"]\n\n1. e4 *')).toBe('987654321')
  })

  it('is null without a chess.com game link', () => {
    expect(chessComGameId('[Event "Casual"]\n\n1. e4 e5 *')).toBeNull()
    expect(chessComGameId('[Link "https://lichess.org/abcdef"]\n\n1. e4 *')).toBeNull()
    expect(chessComGameId(null)).toBeNull()
  })
})

describe('parseSharedGame', () => {
  it('reads id and both players from the chess.com app share text', () => {
    expect(parseSharedGame(
      'Schauen Sie sich dieses #Schachspiel an: jojo2go gegen RiCk_Prime_C137 - https://www.chess.com/game/185820408402',
    )).toEqual({ id: '185820408402', type: null, usernames: ['jojo2go', 'RiCk_Prime_C137'] })
  })

  it('handles English share text and typed links', () => {
    expect(parseSharedGame('Check out this #chess game: alice vs. bob-99 - https://www.chess.com/game/live/123456789'))
      .toEqual({ id: '123456789', type: 'live', usernames: ['alice', 'bob-99'] })
    expect(parseSharedGame('https://www.chess.com/de/game/daily/987654321?move=4'))
      .toEqual({ id: '987654321', type: 'daily', usernames: [] })
    expect(parseSharedGame('https://www.chess.com/analysis/game/live/111222333'))
      .toEqual({ id: '111222333', type: 'live', usernames: [] })
  })

  it('accepts a bare game id and rejects anything else', () => {
    expect(parseSharedGame(' 185820408402 ')).toEqual({ id: '185820408402', type: null, usernames: [] })
    expect(parseSharedGame('1. e4 e5 2. Nf3')).toBeNull()
    expect(parseSharedGame('https://lichess.org/abcdef')).toBeNull()
    expect(parseSharedGame('[Event "Live Chess"]\n[Link "https://www.chess.com/game/live/123456789"]\n\n1. e4 *'))
      .toBeNull()
  })
})

describe('containsGame', () => {
  it('accepts share text, links, bare ids and PGNs', () => {
    expect(containsGame('Schauen Sie sich dieses #Schachspiel an: a1b gegen c2d - https://www.chess.com/game/185820408402')).toBe(true)
    expect(containsGame('  https://www.chess.com/game/live/123456789\n')).toBe(true)
    expect(containsGame('185820408402')).toBe(true)
    expect(containsGame('[Event "Live Chess"]\n\n1. e4 e5 *')).toBe(true)
    expect(containsGame('1. e4 e5 2. Nf3')).toBe(true)
  })

  it('rejects whatever else a clipboard can hold', () => {
    expect(containsGame('')).toBe(false)
    expect(containsGame('Einkaufsliste: Milch, Eier')).toBe(false)
    expect(containsGame('https://lichess.org/abcdef')).toBe(false)
    expect(containsGame('12345')).toBe(false)
  })
})

describe('fetchRecentGames', () => {
  const game = (end_time: number, pgn = '[Event "x"]\n\n1. e4 e5 *') => ({ end_time, pgn })

  it('merges both months newest first and drops games without a PGN', async () => {
    const answers = [
      { games: [game(100), game(300), game(400, '')] },
      { games: [game(200)] },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(answers.shift()))))
    expect((await fetchRecentGames('alice')).map(g => g.end_time)).toEqual([300, 200, 100])
  })

  it('still returns the other month when one request fails', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ games: [game(100)] })))
    vi.stubGlobal('fetch', fetchMock)
    expect((await fetchRecentGames('alice')).map(g => g.end_time)).toEqual([100])
  })

  it('returns nothing for an unknown player', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    expect(await fetchRecentGames('nobody')).toEqual([])
  })
})

describe('decodeTcn', () => {
  it('decodes plain moves and promotions', () => {
    // e2e4 = "mC", e7e5 = "0K"
    expect(decodeTcn('mC0K')).toEqual(['e2e4', 'e7e5'])
    // a7→a8 straight promotion to queen: from a7 (idx 48 = 'W'), target char 64+0*3+1 = idx 65
    const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++='
    expect(decodeTcn('W' + ALPHABET[65])).toEqual(['a7a8q'])
  })

  it('rejects drop moves', () => {
    expect(decodeTcn('=m')).toBeNull()
  })
})

describe('buildPgnFromCallbackGame', () => {
  it('rebuilds a PGN chess.js can load, with headers and clocks', () => {
    const pgn = buildPgnFromCallbackGame({
      moveList: 'mC0K',
      moveTimestamps: '1800,1795',
      pgnHeaders: { White: 'jojo2go', Black: 'RiCk_Prime_C137', Result: '*' },
    })!
    expect(pgn).toContain('[White "jojo2go"]')
    expect(pgn).toContain('1. e2e4 {[%clk 0:03:00.0]} e7e5 {[%clk 0:02:59.5]} *')
    const chess = new Chess()
    chess.loadPgn(pgn.replace(/\{[^}]*\}/g, ''))
    expect(chess.history()).toEqual(['e4', 'e5'])
  })

  it('returns null without moves', () => {
    expect(buildPgnFromCallbackGame(undefined)).toBeNull()
    expect(buildPgnFromCallbackGame({ pgnHeaders: {} })).toBeNull()
  })
})

describe('fetchSharedGamePgn', () => {
  const shared = { id: '185820408402', type: null, usernames: ['jojo2go', 'RiCk_Prime_C137'] }

  it('uses the callback proxy when it answers', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ game: { moveList: 'mC0K', pgnHeaders: {} } })))
    vi.stubGlobal('fetch', fetchMock)
    const pgn = await fetchSharedGamePgn(shared, null)
    expect(pgn).toContain('1. e2e4 e7e5')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]).toEqual(['/api/chesscom-game?id=185820408402'])
  })

  it('falls back to the players\' monthly archives', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      if (url.startsWith('/api/')) return new Response('not here', { status: 404 })
      if (url.includes('/player/rick_prime_c137/')) {
        return new Response(JSON.stringify({
          games: [{ url: 'https://www.chess.com/game/live/185820408402', pgn: '[Event "x"]\n\n1. e4 e5 *' }],
        }))
      }
      return new Response(JSON.stringify({ games: [] }))
    }))
    expect(await fetchSharedGamePgn(shared, 'JOJO2GO')).toBe('[Event "x"]\n\n1. e4 e5 *')
    // jojo2go's three months, then RiCk's first month; the saved username duplicates jojo2go.
    expect(urls.filter(u => u.includes('/player/jojo2go/'))).toHaveLength(3)
  })

  it('returns null when nothing finds the game', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
    expect(await fetchSharedGamePgn(shared, null)).toBeNull()
  })
})
