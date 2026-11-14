import { describe, it, expect } from 'vitest'
import {
  alternativeMoves, analysisCommands, cappedAtBest, parseInfoScore, uciToSan, uciPvToSan, withSecondLine,
  type EvalResult,
} from './uci'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('parseInfoScore', () => {
  it('returns null for non-info and score-less lines', () => {
    expect(parseInfoScore('bestmove e2e4', false)).toBeNull()
    expect(parseInfoScore('info depth 5 nodes 1234 nps 100000', false)).toBeNull()
    expect(parseInfoScore('readyok', false)).toBeNull()
  })

  it('parses a cp score with pv, white to move', () => {
    const info = parseInfoScore(
      'info depth 15 seldepth 21 multipv 1 score cp 34 nodes 100 pv e2e4 e7e5 g1f3',
      false,
    )
    expect(info).toEqual({ multipvIdx: 1, cp: 34, mate: null, pvUci: ['e2e4', 'e7e5', 'g1f3'] })
  })

  it('flips cp into White perspective when Black is to move', () => {
    const info = parseInfoScore('info depth 12 multipv 1 score cp 80 pv e7e5', true)
    expect(info?.cp).toBe(-80)
  })

  it('defaults multipv to 1 when absent', () => {
    const info = parseInfoScore('info depth 10 score cp -15 pv d2d4', false)
    expect(info?.multipvIdx).toBe(1)
    expect(info?.cp).toBe(-15)
  })

  it('converts positive mate to +10000 sentinel (side to move mates)', () => {
    const info = parseInfoScore('info depth 15 multipv 1 score mate 3 pv d1h5', false)
    expect(info).toMatchObject({ cp: 10000, mate: 3 })
  })

  it('converts getting-mated (negative mate) to -10000, and flips for Black', () => {
    expect(parseInfoScore('info depth 15 score mate -2 pv a2a3', false))
      .toMatchObject({ cp: -10000, mate: -2 })
    // Black to move and mating → bad for White
    expect(parseInfoScore('info depth 15 score mate 2 pv d8h4', true))
      .toMatchObject({ cp: -10000, mate: -2 })
  })

  it('treats mate 0 (already checkmated) as cp sentinel with mate null', () => {
    const info = parseInfoScore('info depth 0 score mate 0', false)
    expect(info).toMatchObject({ cp: -10000, mate: null })
    // Black is the one checkmated → good for White
    expect(parseInfoScore('info depth 0 score mate 0', true)).toMatchObject({ cp: 10000, mate: null })
  })

  it('parses multipv 2/3 lines', () => {
    const info = parseInfoScore('info depth 15 multipv 3 score cp -120 pv b1c3 g8f6', false)
    expect(info).toMatchObject({ multipvIdx: 3, cp: -120 })
    expect(info?.pvUci[0]).toBe('b1c3')
  })

  it('yields an empty pv when the line has none', () => {
    expect(parseInfoScore('info depth 15 multipv 1 score cp 10', false)?.pvUci).toEqual([])
  })
})

describe('uciToSan', () => {
  it('converts a legal move', () => {
    expect(uciToSan(START_FEN, 'e2e4')).toBe('e4')
    expect(uciToSan(START_FEN, 'g1f3')).toBe('Nf3')
  })

  it('handles promotion suffixes', () => {
    expect(uciToSan('8/P7/8/8/8/8/8/K1k5 w - - 0 1', 'a7a8q')).toBe('a8=Q')
  })

  it('returns null for (none), missing input, and illegal moves', () => {
    expect(uciToSan(START_FEN, '(none)')).toBeNull()
    expect(uciToSan(null, 'e2e4')).toBeNull()
    expect(uciToSan(START_FEN, null)).toBeNull()
    expect(uciToSan(START_FEN, 'e2e5')).toBeNull()
  })
})

describe('uciPvToSan', () => {
  it('converts a PV to a SAN line', () => {
    expect(uciPvToSan(START_FEN, ['e2e4', 'e7e5', 'g1f3'])).toBe('e4 e5 Nf3')
  })

  it('stops at the first inapplicable move', () => {
    expect(uciPvToSan(START_FEN, ['e2e4', 'e2e4'])).toBe('e4')
    expect(uciPvToSan(START_FEN, [])).toBe('')
  })
})

describe('analysisCommands', () => {
  it('clears the engine state, sets the position and searches to depth with a time cap', () => {
    expect(analysisCommands(START_FEN, 15, 10000)).toEqual([
      'ucinewgame',
      `position fen ${START_FEN}`,
      'go depth 15 movetime 10000',
    ])
  })

  it('restricts the root moves for a second-line search', () => {
    expect(analysisCommands(START_FEN, 12, 7000, ['d2d4', 'g1f3']).at(-1))
      .toBe('go depth 12 movetime 7000 searchmoves d2d4 g1f3')
    expect(analysisCommands(START_FEN, 12, 7000, []).at(-1)).toBe('go depth 12 movetime 7000')
  })
})

describe('alternativeMoves', () => {
  it('lists every legal move but the best one, in UCI', () => {
    const moves = alternativeMoves(START_FEN, 'e4')
    expect(moves).toHaveLength(19)
    expect(moves).toContain('d2d4')
    expect(moves).toContain('g1f3')
    expect(moves).not.toContain('e2e4')
  })

  it('writes promotions with their piece', () => {
    expect(alternativeMoves('8/P6k/8/8/8/8/8/K7 w - - 0 1', 'a8=Q')).toEqual(
      expect.arrayContaining(['a7a8r', 'a7a8b', 'a7a8n']),
    )
  })

  it('is empty without a best move, without an alternative, or for a broken fen', () => {
    expect(alternativeMoves(START_FEN, null)).toEqual([])
    expect(alternativeMoves('r5k1/8/8/8/8/8/2r5/K7 w - - 0 1', 'Kb1')).toEqual([])
    expect(alternativeMoves('not a fen', 'e4')).toEqual([])
  })
})

describe('withSecondLine', () => {
  const BLACK_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
  const result = (cp: number | null, bestMoveSan: string | null): EvalResult => ({
    cp, mate: null, bestMoveSan, pv: bestMoveSan,
    secondBestCp: null, secondBestMoveSan: null, thirdBestCp: null, thirdBestMoveSan: null,
  })

  it('adds the second search\'s best line as the second-best line', () => {
    const merged = withSecondLine(START_FEN, result(30, 'e4'), result(18, 'd4'))
    expect(merged).toEqual({ ...result(30, 'e4'), secondBestCp: 18, secondBestMoveSan: 'd4' })
  })

  it('returns the first result unchanged when the second search failed', () => {
    const first = result(30, 'e4')
    expect(withSecondLine(START_FEN, first, null)).toBe(first)
    expect(withSecondLine(START_FEN, first, result(null, 'd4'))).toBe(first)
    expect(withSecondLine(START_FEN, first, result(18, null))).toBe(first)
  })

  it('caps the second line at the best line, from the side to move\'s view', () => {
    expect(withSecondLine(START_FEN, result(30, 'e4'), result(45, 'd4')).secondBestCp).toBe(30)
    // Black to move: lower is better for Black, so -50 would outrank the best line's -35.
    expect(withSecondLine(BLACK_FEN, result(-35, 'e5'), result(-50, 'c5')).secondBestCp).toBe(-35)
    expect(withSecondLine(BLACK_FEN, result(-35, 'e5'), result(-20, 'c5')).secondBestCp).toBe(-20)
  })

  it('keeps a forced mate the first search missed', () => {
    expect(withSecondLine(START_FEN, result(1387, 'Qh8+'), result(10000, 'gxf5')).secondBestCp).toBe(10000)
    expect(withSecondLine(BLACK_FEN, result(-1387, 'Qh1+'), result(-10000, 'gxf4')).secondBestCp).toBe(-10000)
  })

  it('cappedAtBest leaves a line alone when the best line has no eval', () => {
    expect(cappedAtBest(START_FEN, null, 45)).toBe(45)
  })
})
