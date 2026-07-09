import { describe, it, expect } from 'vitest'
import { Chess, type Move } from 'chess.js'
import { detectThemes } from './tactics'
import { buildBestPreview } from './review'
import type { EvalResult } from '../engine/useEngine'

function playMove(fen: string, san: string): Move {
  return new Chess(fen).move(san) as Move
}

function evalOf(partial: Partial<EvalResult>): EvalResult {
  return {
    cp: null, mate: null, bestMoveSan: null, pv: null,
    secondBestCp: null, secondBestMoveSan: null, thirdBestCp: null, thirdBestMoveSan: null,
    ...partial,
  }
}

const QUIET = evalOf({ cp: 0 })

describe('detectThemes', () => {
  it('flags a hanging piece the move leaves en prise', () => {
    // White queen steps onto the e-file where the black rook wins it for free.
    const move = playMove('4k3/4r3/8/8/8/8/4Q3/4K3 w - - 0 1', 'Qe5')
    const themes = detectThemes(move, QUIET, QUIET, null)
    const hanging = themes.find(t => t.kind === 'hangingPiece')
    expect(hanging).toBeDefined()
    expect(hanging!.description).toContain('queen on e5')
    expect(hanging!.highlight.squares).toContain('e5')
  })

  it('detects a knight fork of king and rook', () => {
    const move = playMove('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'Nc7+')
    const themes = detectThemes(move, QUIET, QUIET, null)
    const fork = themes.find(t => t.kind === 'fork')
    expect(fork).toBeDefined()
    expect(fork!.description).toContain('king')
    expect(fork!.description).toContain('rook')
    expect(fork!.highlight.arrows).toHaveLength(2)
  })

  it('detects an attack on a single higher-value piece', () => {
    const move = playMove('7r/8/8/8/5N2/8/8/4K1k1 w - - 0 1', 'Ng6')
    const themes = detectThemes(move, QUIET, QUIET, null)
    const attack = themes.find(t => t.kind === 'attacksHigherValue')
    expect(attack).toBeDefined()
    expect(attack!.description).toContain('rook on h8')
  })

  it('flags a move that sets up a forced mate for the mover', () => {
    const move = playMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e4')
    const themes = detectThemes(move, QUIET, evalOf({ mate: 2 }), null)
    const mate = themes.find(t => t.kind === 'mateThreat')
    expect(mate).toBeDefined()
    expect(mate!.highlight.arrows).toEqual([{ from: 'e2', to: 'e4' }])
  })

  it('flags a move that allows a forced mate against the mover', () => {
    const move = playMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e4')
    const themes = detectThemes(move, QUIET, evalOf({ mate: -1 }), null)
    const allows = themes.find(t => t.kind === 'allowsMate')
    expect(allows).toBeDefined()
    expect(allows!.highlight.squares).toContain('e1') // white king
  })

  it('flags a missed forced mate, naming the mating move', () => {
    const fenBefore = '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'
    const move = playMove(fenBefore, 'Ra2')
    const bestPreview = buildBestPreview(fenBefore, 'Ra8')
    const themes = detectThemes(move, evalOf({ mate: 1 }), evalOf({ cp: 500 }), bestPreview)
    const missed = themes.find(t => t.kind === 'missedMate')
    expect(missed).toBeDefined()
    expect(missed!.description).toContain('Ra8')
    expect(missed!.description).toContain('checkmate')
  })

  it('flags a missed win when a clearly winning position slips to equal', () => {
    // No mate; mover was winning (+5) before, equal (0) after.
    const fenBefore = '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'
    const move = playMove(fenBefore, 'Ra2')
    const bestPreview = buildBestPreview(fenBefore, 'Ra8')
    const themes = detectThemes(move, evalOf({ cp: 500 }), evalOf({ cp: 0 }), bestPreview)
    const missed = themes.find(t => t.kind === 'missedWin')
    expect(missed).toBeDefined()
    expect(missed!.description).toContain('much stronger')
  })

  it('returns at most two themes, mate-tier first', () => {
    // A blunder that both allows mate and leaves the queen hanging → allowsMate ranks first.
    const move = playMove('4k3/4r3/8/8/8/8/4Q3/4K3 w - - 0 1', 'Qe5')
    const themes = detectThemes(move, QUIET, evalOf({ mate: -2 }), null)
    expect(themes.length).toBeLessThanOrEqual(2)
    expect(themes[0].kind).toBe('allowsMate')
  })

  it('finds no themes for a calm developing move', () => {
    const move = playMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'Nf3')
    expect(detectThemes(move, QUIET, QUIET, null)).toHaveLength(0)
  })
})
