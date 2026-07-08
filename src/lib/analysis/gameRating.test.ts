import { describe, it, expect } from 'vitest'
import { estimateGameRating } from './gameRating'
import type { MoveAnalysis, MoveClass } from './classify'

// moveIndex parity picks the player: even = white, odd = black.
const analysis = (moveIndex: number, classification: MoveClass): MoveAnalysis => ({
  moveIndex,
  lossInWinPct: 0,
  classification,
  accuracy: 100,
})

// A big, all-"Good" move list for the player of interest — enough to clear the
// sample-size damping floor and isolate the accuracy->Elo table + classification adjustment.
function bigGoodGame(player: 'white' | 'black', count = 20): MoveAnalysis[] {
  const analyses: MoveAnalysis[] = []
  for (let i = 0; i < count * 2; i++) {
    const isPlayerMove = player === 'white' ? i % 2 === 0 : i % 2 !== 0
    analyses.push(analysis(i, isPlayerMove ? 'Good' : 'Excellent'))
  }
  return analyses
}

describe('estimateGameRating', () => {
  it('returns null when accuracy is null', () => {
    expect(estimateGameRating({ analyses: [], player: 'white', accuracy: null })).toBeNull()
  })

  it('is monotonically non-decreasing in accuracy', () => {
    const accuracies = [50, 60, 65, 70, 78, 85, 90, 94, 97, 99, 100]
    let prev = -Infinity
    for (const accuracy of accuracies) {
      const rating = estimateGameRating({ analyses: bigGoodGame('white'), player: 'white', accuracy })!
      expect(rating).toBeGreaterThanOrEqual(prev)
      prev = rating
    }
  })

  it('clamps to the table endpoints at/below/above the extremes', () => {
    const low = estimateGameRating({ analyses: bigGoodGame('white'), player: 'white', accuracy: 0 })!
    const high = estimateGameRating({ analyses: bigGoodGame('white'), player: 'white', accuracy: 100 })!
    expect(low).toBeGreaterThanOrEqual(100)
    expect(high).toBeLessThanOrEqual(3500)
  })

  it('rounds to the nearest 50', () => {
    const rating = estimateGameRating({ analyses: bigGoodGame('white'), player: 'white', accuracy: 82 })!
    expect(rating % 50).toBe(0)
  })

  it('same accuracy, more blunders => lower rating', () => {
    const clean = bigGoodGame('white')
    const withBlunders = [...clean]
    // Swap two of the player's own (even-index) Good moves for Blunders.
    let swapped = 0
    for (let i = 0; i < withBlunders.length && swapped < 2; i++) {
      if (withBlunders[i].moveIndex % 2 === 0) {
        withBlunders[i] = analysis(withBlunders[i].moveIndex, 'Blunder')
        swapped++
      }
    }
    // accuracy=82 (not a table breakpoint) so the small per-move adjustment doesn't get
    // rounded away by the nearest-50 step, unlike an exact breakpoint such as 85.
    const ratingClean = estimateGameRating({ analyses: clean, player: 'white', accuracy: 82 })!
    const ratingBlunders = estimateGameRating({ analyses: withBlunders, player: 'white', accuracy: 82 })!
    expect(ratingBlunders).toBeLessThan(ratingClean)
  })

  it('brilliant/great moves push the rating up relative to plain Good', () => {
    // A single-move sample isolates the per-move adjustment size against rounding —
    // no opponentElo means no sample-size damping kicks in either.
    const clean: MoveAnalysis[] = [analysis(0, 'Good')]
    const withBrilliant: MoveAnalysis[] = [analysis(0, 'Brilliant')]
    const ratingClean = estimateGameRating({ analyses: clean, player: 'white', accuracy: 85 })!
    const ratingBrilliant = estimateGameRating({ analyses: withBrilliant, player: 'white', accuracy: 85 })!
    expect(ratingBrilliant).toBeGreaterThan(ratingClean)
  })

  it('dampens toward opponentElo when sample size is small', () => {
    const fewMoves: MoveAnalysis[] = [analysis(0, 'Good'), analysis(1, 'Excellent')]
    const rating = estimateGameRating({
      analyses: fewMoves, player: 'white', accuracy: 99, opponentElo: 800,
    })!
    // Full-sample accuracy=99 alone would land near the top of the table (~2850+); with only
    // one rated move for the player, the estimate should be pulled far down toward 800.
    expect(rating).toBeLessThan(2000)
  })

  it('with no opponentElo and a small sample, does not damp (no regression target)', () => {
    const fewMoves: MoveAnalysis[] = [analysis(0, 'Good')]
    const rating = estimateGameRating({ analyses: fewMoves, player: 'white', accuracy: 99 })!
    expect(rating).toBeGreaterThan(2000)
  })

  it('excludes Book/Forced moves from the classification adjustment', () => {
    const analyses: MoveAnalysis[] = bigGoodGame('white')
    // A Book move for the player must not shift the rating at all (fully excluded from
    // playerMoves) — unlike a Blunder, which does.
    const withBook = [...analyses, analysis(1000, 'Book')]
    const withBlunder = [...analyses, analysis(1000, 'Blunder')]
    const ratingBase = estimateGameRating({ analyses, player: 'white', accuracy: 82 })!
    const ratingWithBook = estimateGameRating({ analyses: withBook, player: 'white', accuracy: 82 })!
    const ratingWithBlunder = estimateGameRating({ analyses: withBlunder, player: 'white', accuracy: 82 })!
    expect(ratingWithBook).toBe(ratingBase)
    expect(ratingWithBlunder).toBeLessThanOrEqual(ratingBase)
  })

  it('is symmetric for the black player using odd move indices', () => {
    const analyses = bigGoodGame('black')
    const rating = estimateGameRating({ analyses, player: 'black', accuracy: 85 })
    expect(rating).not.toBeNull()
  })
})
