import { describe, it, expect } from 'vitest'
import { cacheKey, loadCached, mergeResults, missingIndices } from './analysisCache'
import type { EvalResult } from './uci'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function evalOf(cp: number): EvalResult {
  return {
    cp, mate: null, bestMoveSan: 'e4', pv: 'e4 e5', secondBestCp: null,
    secondBestMoveSan: null, thirdBestCp: null, thirdBestMoveSan: null,
  }
}

describe('analysisCache', () => {
  it('keys on depth and the full fen', () => {
    expect(cacheKey(START_FEN, 15)).not.toBe(cacheKey(START_FEN, 18))
    expect(cacheKey(START_FEN, 15)).toContain(START_FEN)
  })

  it('lists the positions a lookup missed', () => {
    expect(missingIndices([evalOf(1), null, evalOf(2), null])).toEqual([1, 3])
    expect(missingIndices([evalOf(1)])).toEqual([])
  })

  it('slots fresh results into the missed positions only', () => {
    const cached = [evalOf(1), null, evalOf(3), null]
    const merged = mergeResults(cached, [1, 3], [evalOf(2), evalOf(4)])
    expect(merged.map(r => r?.cp)).toEqual([1, 2, 3, 4])
    expect(cached[1]).toBeNull() // input untouched
  })

  it('keeps a watchdog write-off (null) as a miss', () => {
    const merged = mergeResults([null, evalOf(2)], [0], [null])
    expect(merged[0]).toBeNull()
  })

  it('degrades to all-misses without IndexedDB instead of rejecting', async () => {
    // vitest runs in node: there is no indexedDB global at all.
    await expect(loadCached([START_FEN, START_FEN], 15)).resolves.toEqual([null, null])
  })
})
