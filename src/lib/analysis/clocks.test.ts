import { describe, it, expect } from 'vitest'
import { parseTimeControl, parseClocks, moveTimes, formatMoveTime, remainingClockSeconds, formatClock } from './clocks'

describe('parseTimeControl', () => {
  it('parses a plain seconds control', () => {
    expect(parseTimeControl('600')).toEqual({ initialSeconds: 600, incrementSeconds: 0 })
  })
  it('parses seconds+increment', () => {
    expect(parseTimeControl('180+2')).toEqual({ initialSeconds: 180, incrementSeconds: 2 })
  })
  it('returns null for missing/unsupported formats', () => {
    expect(parseTimeControl(undefined)).toBeNull()
    expect(parseTimeControl(null)).toBeNull()
    expect(parseTimeControl('-')).toBeNull()
    expect(parseTimeControl('1/259200')).toBeNull()
  })
})

describe('parseClocks', () => {
  it('extracts clock seconds in ply order from a raw PGN', () => {
    const pgn = '1. e4 {[%clk 0:09:58]} e5 {[%clk 0:09:59]} 2. Nf3 {[%clk 0:09:50]} Nc6 {[%clk 0:09:55]}'
    expect(parseClocks(pgn)).toEqual([598, 599, 590, 595])
  })

  it('parses H:MM:SS.f fractional seconds by truncating via the integer parts', () => {
    const pgn = '1. e4 {[%clk 0:00:58.1]}'
    expect(parseClocks(pgn)).toEqual([58.1])
  })

  it('returns an empty array when there are no %clk comments', () => {
    expect(parseClocks('1. e4 e5 2. Nf3 Nc6')).toEqual([])
  })

  it('ignores non-%clk brace comments', () => {
    const pgn = '1. e4 {a book move} e5 {[%clk 0:09:59]}'
    expect(parseClocks(pgn)).toEqual([599])
  })
})

describe('moveTimes', () => {
  it('computes spend from the previous same-side reading', () => {
    // White: 600 -> 598 -> 590 (spent 2s, then 8s). Black: 600 -> 599 -> 595 (spent 1s, then 4s).
    const clocks = [598, 599, 590, 595]
    const tc = { initialSeconds: 600, incrementSeconds: 0 }
    expect(moveTimes(clocks, tc)).toEqual([2, 1, 8, 4])
  })

  it('adds the increment to each spend', () => {
    const clocks = [599, 600] // +2 increment more than offsets the 1s spent
    const tc = { initialSeconds: 600, incrementSeconds: 2 }
    expect(moveTimes(clocks, tc)).toEqual([3, 2])
  })

  it('returns null for the first move of each side without a time control', () => {
    const clocks = [598, 599, 590, 595]
    expect(moveTimes(clocks, null)).toEqual([null, null, 8, 4])
  })

  it('propagates a null clock reading to its own ply and to the ply that references it', () => {
    const clocks = [598, null, 590, 585]
    const tc = { initialSeconds: 600, incrementSeconds: 0 }
    // i=1 (Black's 1st) is null directly; i=3 (Black's 2nd) has a real reading (585) but its
    // previous-same-side reference (clocks[1]) is null, so its spend is unknowable too.
    // i=2 (White's 2nd) is unaffected — its reference is clocks[0], which is present.
    expect(moveTimes(clocks, tc)).toEqual([2, null, 8, null])
  })
})

describe('formatMoveTime', () => {
  it('formats under a minute', () => {
    expect(formatMoveTime(7)).toBe('0:07')
  })
  it('formats over a minute', () => {
    expect(formatMoveTime(83)).toBe('1:23')
  })
  it('rounds fractional seconds', () => {
    expect(formatMoveTime(7.6)).toBe('0:08')
  })
})

describe('remainingClockSeconds', () => {
  const clocks = [598, 599, 590, 595] // White: 598,590 (i=0,2)  Black: 599,595 (i=1,3)
  const tc = { initialSeconds: 600, incrementSeconds: 0 }

  it('falls back to the time control before either side has moved', () => {
    expect(remainingClockSeconds(clocks, 0, 'white', tc)).toBe(600)
    expect(remainingClockSeconds(clocks, 0, 'black', tc)).toBe(600)
  })

  it('returns null before either side has moved without a time control', () => {
    expect(remainingClockSeconds(clocks, 0, 'white', null)).toBeNull()
  })

  it('picks up the latest reading at or before the given ply', () => {
    expect(remainingClockSeconds(clocks, 1, 'white', tc)).toBe(598)
    expect(remainingClockSeconds(clocks, 1, 'black', tc)).toBe(600) // Black hasn't moved yet
    expect(remainingClockSeconds(clocks, 2, 'black', tc)).toBe(599)
    expect(remainingClockSeconds(clocks, 4, 'white', tc)).toBe(590)
    expect(remainingClockSeconds(clocks, 4, 'black', tc)).toBe(595)
  })

  it('holds the last known reading past a null entry rather than reverting', () => {
    const withGap = [598, null, 590, 595]
    expect(remainingClockSeconds(withGap, 2, 'black', tc)).toBe(600) // still no real Black reading
    expect(remainingClockSeconds(withGap, 4, 'black', tc)).toBe(595)
  })
})

describe('formatClock', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatClock(598)).toBe('9:58')
  })
  it('formats an hour or more as h:mm:ss', () => {
    expect(formatClock(3723)).toBe('1:02:03')
  })
  it('clamps negative input to zero', () => {
    expect(formatClock(-5)).toBe('0:00')
  })
})
