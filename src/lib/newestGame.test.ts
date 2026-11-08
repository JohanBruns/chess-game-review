import { describe, it, expect } from 'vitest'
import { decideNewestGame, gameIdFromUrl, RESUME_AWAY_MS, type NewestGameInput } from './newestGame'

const base: NewestGameInput = {
  trigger: 'start',
  newestId: '200',
  loadedId: null,
  hasGame: false,
  lastHandledId: null,
  awayMs: 0,
  busy: false,
}

describe('decideNewestGame', () => {
  it('loads the newest game on a cold start with an empty board', () => {
    expect(decideNewestGame(base)).toBe('load')
    // Even one handled before: its analysis is cached, and an empty board helps no one.
    expect(decideNewestGame({ ...base, lastHandledId: '200' })).toBe('load')
  })

  it('leaves a cold start alone when a link or shared game already put a game up', () => {
    expect(decideNewestGame({ ...base, hasGame: true, loadedId: '150' })).toBeNull()
  })

  it('does nothing without a newest game or when it is already on the board', () => {
    expect(decideNewestGame({ ...base, newestId: null })).toBeNull()
    expect(decideNewestGame({ ...base, trigger: 'poll', hasGame: true, loadedId: '200' })).toBeNull()
  })

  it('loads a new game when the app comes back after a while away', () => {
    const resume = { ...base, trigger: 'resume' as const, hasGame: true, loadedId: '150', lastHandledId: '150' }
    expect(decideNewestGame({ ...resume, awayMs: RESUME_AWAY_MS })).toBe('load')
    // A quick app switch only offers it.
    expect(decideNewestGame({ ...resume, awayMs: 5_000 })).toBe('offer')
    // Never swaps the game under practice, puzzles or a running analysis.
    expect(decideNewestGame({ ...resume, awayMs: RESUME_AWAY_MS, busy: true })).toBe('offer')
  })

  it('offers a game that shows up while the app stays open, once', () => {
    const poll = { ...base, trigger: 'poll' as const, hasGame: true, loadedId: '150', lastHandledId: '150' }
    expect(decideNewestGame(poll)).toBe('offer')
    expect(decideNewestGame({ ...poll, lastHandledId: '200' })).toBeNull()
    expect(decideNewestGame({ ...poll, trigger: 'resume', awayMs: RESUME_AWAY_MS, lastHandledId: '200' })).toBeNull()
  })
})

describe('gameIdFromUrl', () => {
  it('reads archive and share URLs', () => {
    expect(gameIdFromUrl('https://www.chess.com/game/live/186803383606')).toBe('186803383606')
    expect(gameIdFromUrl('https://www.chess.com/game/daily/987654321')).toBe('987654321')
    expect(gameIdFromUrl('https://www.chess.com/game/185820408402')).toBe('185820408402')
    expect(gameIdFromUrl('https://lichess.org/abc')).toBeNull()
    expect(gameIdFromUrl(undefined)).toBeNull()
  })
})
