import { describe, it, expect } from 'vitest'
import { analyzeTwoPass, type RunBatch } from './twoPass'
import type { EvalResult, SearchJob } from './uci'

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
// White is in check from the a8-rook and has a single legal move (Kb1).
const ONE_MOVE = 'r5k1/8/8/8/8/8/2r5/K7 w - - 0 1'

function evalOf(cp: number, bestMoveSan: string, second?: { cp: number; san: string }): EvalResult {
  return {
    cp, mate: null, bestMoveSan, pv: bestMoveSan,
    secondBestCp: second?.cp ?? null, secondBestMoveSan: second?.san ?? null,
    thirdBestCp: null, thirdBestMoveSan: null,
  }
}

// A stand-in engine: answers from `answer` and records every batch it was given.
function fakeEngine(answer: (job: SearchJob) => EvalResult | null) {
  const batches: SearchJob[][] = []
  const runBatch: RunBatch = async (jobs, onDone) => {
    batches.push(jobs)
    return jobs.map((job, i) => {
      onDone(i + 1)
      return answer(job)
    })
  }
  return { batches, runBatch }
}

// First pass: e4 / e5. Second line (searchMoves given): d4 / c5.
const answer = (job: SearchJob): EvalResult => {
  const white = job.fen === START
  if (job.searchMoves) return white ? evalOf(20, 'd4') : evalOf(-25, 'c5')
  return white ? evalOf(30, 'e4') : evalOf(-35, 'e5')
}

describe('analyzeTwoPass', () => {
  it('searches every position once and a second line only for the candidates', async () => {
    const engine = fakeEngine(answer)
    const outcome = await analyzeTwoPass({
      fens: [START, AFTER_E4],
      known: [null, null],
      selectCandidates: () => [1],
      runBatch: engine.runBatch,
    })
    expect(engine.batches).toHaveLength(2)
    expect(engine.batches[0]).toEqual([{ fen: START }, { fen: AFTER_E4 }])
    expect(engine.batches[1]).toHaveLength(1)
    expect(engine.batches[1][0].fen).toBe(AFTER_E4)
    // Every legal reply but the best one.
    expect(engine.batches[1][0].searchMoves).toHaveLength(19)
    expect(engine.batches[1][0].searchMoves).not.toContain('e7e5')
    expect(outcome?.results).toEqual([
      evalOf(30, 'e4'),
      evalOf(-35, 'e5', { cp: -25, san: 'c5' }),
    ])
    expect(outcome?.changed).toEqual([0, 1])
  })

  it('hands the first-pass results to the candidate selection', async () => {
    const engine = fakeEngine(answer)
    let seen: (EvalResult | null)[] = []
    await analyzeTwoPass({
      fens: [START, AFTER_E4],
      known: [null, null],
      selectCandidates: firstPass => { seen = firstPass; return [] },
      runBatch: engine.runBatch,
    })
    expect(seen).toEqual([evalOf(30, 'e4'), evalOf(-35, 'e5')])
    expect(engine.batches).toHaveLength(1)
  })

  it('skips the engine for known results and only extends the ones lacking a needed second line', async () => {
    const engine = fakeEngine(answer)
    const complete = evalOf(30, 'e4', { cp: 20, san: 'd4' })
    const outcome = await analyzeTwoPass({
      fens: [START, AFTER_E4],
      known: [complete, evalOf(-35, 'e5')],
      selectCandidates: () => [0, 1],
      runBatch: engine.runBatch,
    })
    expect(engine.batches).toHaveLength(1)
    expect(engine.batches[0].map(job => job.fen)).toEqual([AFTER_E4])
    expect(outcome?.results[0]).toBe(complete)
    expect(outcome?.results[1]?.secondBestMoveSan).toBe('c5')
    expect(outcome?.changed).toEqual([1])
  })

  it('runs no engine at all when nothing is missing', async () => {
    const engine = fakeEngine(answer)
    const known = [evalOf(30, 'e4'), evalOf(-35, 'e5')]
    const outcome = await analyzeTwoPass({
      fens: [START, AFTER_E4], known, selectCandidates: () => [], runBatch: engine.runBatch,
    })
    expect(engine.batches).toEqual([])
    expect(outcome).toEqual({ results: known, changed: [] })
  })

  it('asks for no second line where the best move has no alternative', async () => {
    const engine = fakeEngine(() => evalOf(-900, 'Kb1'))
    const outcome = await analyzeTwoPass({
      fens: [ONE_MOVE], known: [null], selectCandidates: () => [0], runBatch: engine.runBatch,
    })
    expect(engine.batches).toHaveLength(1)
    expect(outcome?.results[0]?.secondBestMoveSan).toBeNull()
  })

  it('keeps the first-pass result when a search is written off', async () => {
    const engine = fakeEngine(job => (job.searchMoves || job.fen === AFTER_E4 ? null : answer(job)))
    const outcome = await analyzeTwoPass({
      fens: [START, AFTER_E4], known: [null, null], selectCandidates: () => [0, 1], runBatch: engine.runBatch,
    })
    expect(outcome?.results).toEqual([evalOf(30, 'e4'), null])
    expect(outcome?.changed).toEqual([0])
  })

  it('never rates the second line above the best one', async () => {
    // The second search comes back better (for the side to move) than the first pass's eval.
    const engine = fakeEngine(job => {
      const white = job.fen === START
      if (job.searchMoves) return white ? evalOf(55, 'd4') : evalOf(-60, 'c5')
      return answer(job)
    })
    const outcome = await analyzeTwoPass({
      fens: [START, AFTER_E4], known: [null, null], selectCandidates: () => [0, 1], runBatch: engine.runBatch,
    })
    expect(outcome?.results[0]).toEqual(evalOf(30, 'e4', { cp: 30, san: 'd4' }))
    expect(outcome?.results[1]).toEqual(evalOf(-35, 'e5', { cp: -35, san: 'c5' }))
  })

  it('stops after a cancelled first pass', async () => {
    const engine = fakeEngine(answer)
    let cancelled = false
    const runBatch: RunBatch = async (jobs, onDone) => {
      const results = await engine.runBatch(jobs, onDone)
      cancelled = true
      return results
    }
    const outcome = await analyzeTwoPass({
      fens: [START, AFTER_E4], known: [null, null], selectCandidates: () => [0, 1], runBatch,
      isCancelled: () => cancelled,
    })
    expect(outcome).toBeNull()
    expect(engine.batches).toHaveLength(1)
  })

  it('reports progress that never goes back and ends at 1', async () => {
    const engine = fakeEngine(answer)
    const fractions: number[] = []
    await analyzeTwoPass({
      fens: [START, AFTER_E4, START, AFTER_E4],
      known: [null, null, null, null],
      selectCandidates: () => [0, 1, 2, 3],
      runBatch: engine.runBatch,
      onProgress: fraction => fractions.push(fraction),
    })
    expect(fractions.length).toBeGreaterThan(1)
    expect(fractions).toEqual([...fractions].sort((a, b) => a - b))
    expect(fractions.at(-1)).toBe(1)
    expect(fractions.every(f => f > 0 && f <= 1)).toBe(true)
  })
})
