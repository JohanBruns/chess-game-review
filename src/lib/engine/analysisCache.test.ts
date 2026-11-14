import { describe, it, expect } from 'vitest'
import { cacheKey, loadCached } from './analysisCache'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

describe('analysisCache', () => {
  it('keys on depth and the full fen', () => {
    expect(cacheKey(START_FEN, 15)).not.toBe(cacheKey(START_FEN, 18))
    expect(cacheKey(START_FEN, 15)).toContain(START_FEN)
  })

  it('degrades to all-misses without IndexedDB instead of rejecting', async () => {
    // vitest runs in node: there is no indexedDB global at all.
    await expect(loadCached([START_FEN, START_FEN], 15)).resolves.toEqual([null, null])
  })
})
