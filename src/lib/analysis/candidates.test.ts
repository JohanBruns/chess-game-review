import { describe, it, expect } from 'vitest'
import { Chess, type Move } from 'chess.js'
import { secondLineCandidates } from './candidates'
import { buildMoveAnalyses } from './classify'
import { detectOpening } from './openings'
import { extractPuzzles, PUZZLE_CLASSES } from './puzzles'
import type { EvalResult } from '../engine/uci'

// The two-pass analysis searches a second line only for the candidates, so the review must
// not read it anywhere else. Checked on the parity games (real engine results): giving every
// OTHER position an arbitrary second line may not change a single class or puzzle.

interface Fixture {
  id: string
  whiteElo: number | null
  blackElo: number | null
  sans: string[]
  evalResults: EvalResult[]
}

const fixtures = Object.values(
  import.meta.glob<Fixture>('./__fixtures__/parity/*.json', { eager: true, import: 'default' }),
)

function replay(fixture: Fixture) {
  const chess = new Chess()
  for (const san of fixture.sans) chess.move(san)
  const moves = chess.history({ verbose: true }) as Move[]
  const fens = [moves[0].before, ...moves.map(m => m.after)]
  return { moves, fens, white: fixture.whiteElo ?? undefined, black: fixture.blackElo ?? undefined }
}

const withoutSecondLine = (r: EvalResult): EvalResult => ({ ...r, secondBestCp: null, secondBestMoveSan: null })

// Deterministic pseudo-random numbers in [0, 1) (mulberry32).
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// How far below the best line the made-up second line sits (centipawns, mover's view) — from
// "just as good" over every classification threshold down to "everything else gets mated".
const GAPS = [0, 1, 25, 80, 200, 450, 900, 2500, 20000]

describe('secondLineCandidates', () => {
  it('covers the parity fixtures', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(20)
  })

  for (const fixture of fixtures) {
    it(`${fixture.id}: only the candidates' second lines can change the review`, () => {
      const { moves, fens, white, black } = replay(fixture)
      const firstPass = fixture.evalResults.map(withoutSecondLine)
      const candidates = new Set(secondLineCandidates(moves, firstPass, white, black))

      // The capture ran the same selection: second lines exist for candidates only.
      fixture.evalResults.forEach((r, i) => {
        if (r.secondBestMoveSan != null) expect(candidates.has(i)).toBe(true)
      })

      const review = (evalResults: EvalResult[], openingPly: number) => {
        const analyses = buildMoveAnalyses(moves, evalResults, openingPly, white, black)
        return {
          classes: analyses.map(a => `${a.moveIndex}:${a.classification}`),
          puzzles: extractPuzzles(moves, fens, evalResults, analyses).map(p => p.moveIndex),
        }
      }
      const random = rng(Number(fixture.id.slice(-6)))
      // With and without the opening book: the selection has to hold for either.
      for (const openingPly of [0, detectOpening(fens)?.fenPly ?? 0]) {
        const expected = review(fixture.evalResults, openingPly)
        for (let trial = 0; trial < 12; trial++) {
          const fuzzed = fixture.evalResults.map((r, i) => {
            if (candidates.has(i) || r.cp === null) return r
            const gap = GAPS[Math.floor(random() * GAPS.length)]
            const whiteToMove = i % 2 === 0
            const secondBestCp = Math.max(-10000, Math.min(10000, whiteToMove ? r.cp - gap : r.cp + gap))
            return { ...r, secondBestCp, secondBestMoveSan: 'Kh1' }
          })
          expect(review(fuzzed, openingPly)).toEqual(expected)
        }
      }
    })
  }

  it('includes every Mistake/Miss/Blunder ply (their positions are the puzzle material)', () => {
    for (const fixture of fixtures) {
      const { moves, white, black } = replay(fixture)
      const candidates = new Set(secondLineCandidates(moves, fixture.evalResults, white, black))
      for (const analysis of buildMoveAnalyses(moves, fixture.evalResults, 0, white, black)) {
        if (PUZZLE_CLASSES.has(analysis.classification)) expect(candidates.has(analysis.moveIndex)).toBe(true)
      }
    }
  })

  it('selects a minority of the positions (the point of the second pass)', () => {
    let positions = 0
    let selected = 0
    for (const fixture of fixtures) {
      const { moves, white, black } = replay(fixture)
      positions += fixture.evalResults.length
      selected += secondLineCandidates(moves, fixture.evalResults.map(withoutSecondLine), white, black).length
    }
    expect(selected / positions).toBeLessThan(0.5)
  })

  it('returns ascending position indices and nothing for a game without results', () => {
    const { moves, white, black } = replay(fixtures[0])
    const candidates = secondLineCandidates(moves, fixtures[0].evalResults, white, black)
    expect(candidates).toEqual([...candidates].sort((a, b) => a - b))
    expect(secondLineCandidates(moves, new Array(moves.length + 1).fill(null))).toEqual([])
  })
})
