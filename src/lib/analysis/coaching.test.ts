import { describe, it, expect } from 'vitest'
import { buildCoachingPrompt } from './coaching'
import type { EvalResult } from '../engine/useEngine'
import type { MoveAnalysis } from './classify'

const ev = (cp: number, bestMoveSan: string | null = null, pv: string | null = null): EvalResult => ({
  cp, mate: null, bestMoveSan, pv,
})

const analysis: MoveAnalysis = {
  moveIndex: 4,
  lossInWinPct: 22.5,
  classification: 'Blunder',
  accuracy: 20,
}

describe('buildCoachingPrompt', () => {
  it('includes FEN, played move, and classification', () => {
    const prompt = buildCoachingPrompt({
      fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      sanPlayed: 'Nc6',
      evalBefore: ev(30, 'Nf6', 'Nf6 e5 Nc3'),
      evalAfter: ev(-50),
      analysis,
    })
    expect(prompt).toContain('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')
    expect(prompt).toContain('Nc6')
    expect(prompt).toContain('Blunder')
  })

  it('includes engine eval before and after', () => {
    const prompt = buildCoachingPrompt({
      fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      sanPlayed: 'Nc6',
      evalBefore: ev(30, 'Nf6'),
      evalAfter: ev(-50),
      analysis,
    })
    expect(prompt).toContain('+0.30')
    expect(prompt).toContain('-0.50')
  })

  it('includes best move and PV', () => {
    const prompt = buildCoachingPrompt({
      fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      sanPlayed: 'Nc6',
      evalBefore: ev(30, 'Nf6', 'Nf6 e5 Nc3 d5'),
      evalAfter: ev(-50),
      analysis,
    })
    expect(prompt).toContain('Nf6')
    expect(prompt).toContain('Nf6 e5 Nc3 d5')
  })

  it('includes win-% loss', () => {
    const prompt = buildCoachingPrompt({
      fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      sanPlayed: 'Nc6',
      evalBefore: ev(30, 'Nf6'),
      evalAfter: ev(-50),
      analysis,
    })
    expect(prompt).toContain('22.5')
  })
})
