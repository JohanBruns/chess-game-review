// Relative imports carry their .ts extension here: Node loads this module directly too
// (scripts/captureParityFixtures.ts), without a bundler to resolve them.
import { alternativeMoves, withSecondLine, type EvalResult, type SearchJob } from './uci.ts'

// The whole-game analysis in two passes, shared by the app (useEngine + enginePool) and the
// Node fixture capture so both produce the same results:
//
//   1. every position gets a single-PV search — eval, best move, PV;
//   2. the positions whose classification can depend on the second-best line (the caller's
//      selectCandidates, see analysis/candidates.ts) get one more search restricted to every
//      move but the best one. Its top line is the second-best line.
//
// Measured 2026-11 on the parity games (depth 15): a MultiPV-3 search of every position costs
// about three single-PV searches, while only 31% of the positions ever have their second line
// read and none their third. Two passes do the same job in roughly half the time (in the
// browser, 75 positions on 4 workers: 9.6-11.4 s before, 4.9 s after).
//
// Both searches start from a cleared hash (uci.ts analysisCommands), so a result still depends
// only on (fen, depth) — the second line through the first pass's best move, which is itself a
// function of (fen, depth). Per-position caching stays sound; a cached entry may simply lack a
// second line that a later game asks for, which then costs just the second search.

// Runs the jobs on the engine(s); resolves with one result per job (null = search written off).
// `onDone` reports the number of finished jobs.
export type RunBatch = (jobs: SearchJob[], onDone: (done: number) => void) => Promise<(EvalResult | null)[]>

export interface TwoPassOptions {
  fens: string[]
  // Results already at hand (cache hits), one slot per fen; null = to be searched.
  known: (EvalResult | null)[]
  // Positions (indices into fens) that need a second line, given the first-pass results.
  selectCandidates: (firstPass: (EvalResult | null)[]) => number[]
  runBatch: RunBatch
  // Checked after each pass; a cancelled run starts nothing more and resolves with null.
  isCancelled?: () => boolean
  // Share of the engine work done so far, 0..1, never decreasing.
  onProgress?: (fraction: number) => void
}

export interface TwoPassResult {
  results: (EvalResult | null)[]
  // Positions whose result was searched or extended in this run (for the cache).
  changed: number[]
}

// Typical share of positions that get a second search — only used to scale the progress of the
// first pass before the real number is known.
const SECOND_PASS_ESTIMATE = 0.3

export async function analyzeTwoPass(options: TwoPassOptions): Promise<TwoPassResult | null> {
  const { fens, known, selectCandidates, runBatch, isCancelled, onProgress } = options
  const results = [...known]
  const changed = new Set<number>()

  let reported = 0
  const report = (done: number, total: number) => {
    const fraction = total > 0 ? Math.min(1, done / total) : 1
    if (fraction > reported) {
      reported = fraction
      onProgress?.(fraction)
    }
  }

  const missing: number[] = []
  results.forEach((r, i) => { if (r == null) missing.push(i) })
  if (missing.length > 0) {
    const expected = missing.length + Math.round(SECOND_PASS_ESTIMATE * missing.length)
    const fresh = await runBatch(missing.map(i => ({ fen: fens[i] })), done => report(done, expected))
    if (isCancelled?.()) return null
    missing.forEach((idx, k) => {
      const result = fresh[k] ?? null
      results[idx] = result
      if (result) changed.add(idx)
    })
  }

  const secondJobs: SearchJob[] = []
  const secondIndices: number[] = []
  for (const idx of selectCandidates(results)) {
    const first = results[idx]
    if (!first || first.secondBestMoveSan != null) continue
    const searchMoves = alternativeMoves(fens[idx], first.bestMoveSan)
    if (searchMoves.length === 0) continue
    secondJobs.push({ fen: fens[idx], searchMoves })
    secondIndices.push(idx)
  }
  if (secondJobs.length > 0) {
    const total = missing.length + secondJobs.length
    const second = await runBatch(secondJobs, done => report(missing.length + done, total))
    if (isCancelled?.()) return null
    secondIndices.forEach((idx, k) => {
      const first = results[idx]
      if (!first) return
      const extended = withSecondLine(fens[idx], first, second[k] ?? null)
      if (extended !== first) {
        results[idx] = extended
        changed.add(idx)
      }
    })
  }

  return { results, changed: [...changed].sort((a, b) => a - b) }
}
