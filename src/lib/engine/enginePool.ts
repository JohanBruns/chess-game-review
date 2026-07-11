import type { EvalResult } from './useEngine'
import { parseInfoScore, uciToSan, uciPvToSan } from './uci'

// Worker pool for the whole-game batch analysis. N independent single-thread WASM engine
// instances (the exact same build the primary worker uses — NOT the rejected pthread
// multi-thread build) pull positions from a shared cursor, so the ~100-500ms searches run
// in parallel instead of serially. Results are identical to the serial sweep (fixed depth);
// only the wall time scales with the machine's cores. The pool is only used by
// useEngine.analyzeGame — all interactive paths (evaluate/refinePosition/requestPlayMove)
// stay on the primary worker.

// Per-position time caps, passed alongside the depth limit (`go depth D movetime T` stops
// at whichever limit is hit first). Depth terminates virtually every search long before
// these caps; they only rein in pathological outlier positions. Keyed by the settings
// depth (12/15/18 = the Fast/Balanced/Deep presets).
const BATCH_MOVETIME_MS: Record<number, number> = { 12: 7000, 15: 10000, 18: 20000 }
// Grace period after the movetime cap before the watchdog assumes an engine is dead.
const WATCHDOG_GRACE_MS = 2000
const INIT_TIMEOUT_MS = 15000
// Diminishing returns + RAM beyond 4 instances; one core stays free for the main thread
// (a busy main thread delays bestmove delivery — see useEngine's publish-throttle notes).
const MAX_POOL_SIZE = 4
// Smaller than the primary worker's 128MB — N instances run at once, and each one only
// sees a slice of the game, so a big shared transposition table pays off less.
const POOL_HASH_MB = 32

export function poolSize(): number {
  return Math.min(MAX_POOL_SIZE, Math.max(1, (navigator.hardwareConcurrency ?? 4) - 1))
}

interface SearchState {
  batch: Batch
  idx: number
  fen: string
  cp: number | null
  mate: number | null
  pv: string[]
  secondCp: number | null
  secondUci: string | null
  thirdCp: number | null
  thirdUci: string | null
  stopTimer: ReturnType<typeof setTimeout> | null
  graceTimer: ReturnType<typeof setTimeout> | null
}

interface PoolWorker {
  worker: Worker
  ready: Promise<void>
  alive: boolean
  // Number of `go` commands whose bestmove is still outstanding. Searches are strictly
  // sequential per worker, so > 1 only happens when a `stop`-superseded search's reply is
  // still in flight — those stale bestmoves are swallowed by count, like useEngine does.
  outstanding: number
  search: SearchState | null
}

interface Batch {
  fens: string[]
  depth: number
  movetime: number
  results: (EvalResult | null)[]
  cursor: number
  // Unfinalized positions (finalized = result recorded, or written off by the watchdog).
  remaining: number
  done: number
  aborted: boolean
  settled: boolean
  onProgress: (done: number, total: number) => void
  resolve: (results: (EvalResult | null)[]) => void
}

let workers: PoolWorker[] = []
let activeBatch: Batch | null = null
// Guards the async init window: a second analyzeBatch (or abort) during `await ready`
// supersedes the first before it ever set activeBatch.
let batchSeq = 0

function killWorker(pw: PoolWorker) {
  pw.alive = false
  pw.search = null
  pw.worker.terminate()
}

function clearTimers(s: SearchState) {
  if (s.stopTimer !== null) clearTimeout(s.stopTimer)
  if (s.graceTimer !== null) clearTimeout(s.graceTimer)
  s.stopTimer = null
  s.graceTimer = null
}

function settle(batch: Batch) {
  if (batch.settled) return
  batch.settled = true
  if (activeBatch === batch) activeBatch = null
  batch.resolve(batch.results)
}

// Assign the next unanalyzed position to an idle worker.
function pump(pw: PoolWorker) {
  const batch = activeBatch
  if (!batch || batch.aborted || !pw.alive || pw.search !== null || pw.outstanding > 0) return
  if (batch.cursor >= batch.fens.length) return
  const idx = batch.cursor++
  const s: SearchState = {
    batch,
    idx,
    fen: batch.fens[idx],
    cp: null,
    mate: null,
    pv: [],
    secondCp: null,
    secondUci: null,
    thirdCp: null,
    thirdUci: null,
    stopTimer: null,
    graceTimer: null,
  }
  pw.search = s
  pw.worker.postMessage(`position fen ${s.fen}`)
  pw.worker.postMessage(`go depth ${batch.depth} movetime ${batch.movetime}`)
  pw.outstanding++
  // `go movetime` self-terminates, so this only fires if the engine went silent: ask it to
  // stop, and only if even that produces no bestmove (engine truly dead), write the
  // position off and drop the worker — the shared cursor redistributes the rest.
  s.stopTimer = setTimeout(() => {
    s.stopTimer = null
    pw.worker.postMessage('stop')
    s.graceTimer = setTimeout(() => {
      s.graceTimer = null
      const b = s.batch
      killWorker(pw)
      if (b === activeBatch && !b.aborted) {
        b.remaining--
        b.onProgress(b.done, b.fens.length)
        if (b.remaining === 0 || !workers.some(w => w.alive)) settle(b)
      }
    }, WATCHDOG_GRACE_MS)
  }, batch.movetime + WATCHDOG_GRACE_MS)
}

function handleMessage(pw: PoolWorker, line: string) {
  const s = pw.search

  if (line.startsWith('info')) {
    if (!s) return
    const info = parseInfoScore(line, s.fen.split(' ')[1] === 'b')
    if (!info) return
    if (info.multipvIdx === 1) {
      s.cp = info.cp
      s.mate = info.mate
      if (info.pvUci.length > 0) s.pv = info.pvUci.slice(0, 10)
    } else if (info.multipvIdx === 2 && info.cp !== null) {
      s.secondCp = info.cp
      if (info.pvUci.length > 0) s.secondUci = info.pvUci[0]
    } else if (info.multipvIdx === 3 && info.cp !== null) {
      s.thirdCp = info.cp
      if (info.pvUci.length > 0) s.thirdUci = info.pvUci[0]
    }
    return
  }

  if (line.startsWith('bestmove')) {
    pw.outstanding = Math.max(0, pw.outstanding - 1)
    if (pw.outstanding > 0) return // stale reply of a superseded search
    pw.search = null
    if (s) {
      clearTimers(s)
      const batch = s.batch
      if (batch === activeBatch && !batch.aborted && !batch.settled) {
        const uciMove = line.split(' ')[1]
        batch.results[s.idx] = {
          cp: s.cp,
          mate: s.mate,
          bestMoveSan: uciToSan(s.fen, uciMove),
          pv: s.pv.length > 0 ? uciPvToSan(s.fen, s.pv) : null,
          secondBestCp: s.secondCp,
          secondBestMoveSan: uciToSan(s.fen, s.secondUci),
          thirdBestCp: s.thirdCp,
          thirdBestMoveSan: uciToSan(s.fen, s.thirdUci),
        }
        batch.done++
        batch.remaining--
        batch.onProgress(batch.done, batch.fens.length)
        if (batch.remaining === 0) {
          settle(batch)
          return
        }
      }
    }
    // Freed up (normally, or from an aborted batch's final bestmove) → rejoin the live batch.
    pump(pw)
  }
}

function spawnWorker(): PoolWorker {
  const worker = new Worker('/engine/stockfish-18-lite-single.js')
  const pw: PoolWorker = { worker, ready: Promise.resolve(), alive: true, outstanding: 0, search: null }
  pw.ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      killWorker(pw)
      reject(new Error('engine pool: init timeout'))
    }, INIT_TIMEOUT_MS)
    let phase: 'uci' | 'isready' = 'uci'
    worker.onmessage = (e: MessageEvent<string>) => {
      const line = String(e.data).trim()
      if (phase === 'uci' && line === 'uciok') {
        phase = 'isready'
        worker.postMessage('isready')
        return
      }
      if (phase === 'isready' && line === 'readyok') {
        clearTimeout(timeout)
        worker.postMessage('setoption name MultiPV value 3')
        worker.postMessage(`setoption name Hash value ${POOL_HASH_MB}`)
        worker.onmessage = (ev: MessageEvent<string>) => handleMessage(pw, String(ev.data).trim())
        resolve()
      }
    }
    worker.onerror = () => {
      clearTimeout(timeout)
      killWorker(pw)
      reject(new Error('engine pool: worker error'))
    }
    worker.postMessage('uci')
  })
  return pw
}

// Aborts the in-flight batch (if any): its promise resolves immediately with the partial
// results (callers discard them), busy workers get `stop` and rejoin the next batch when
// their bestmove lands. Watchdog timers stay armed so a truly dead worker still gets culled.
export function abortBatch() {
  batchSeq++
  const batch = activeBatch
  if (!batch) return
  batch.aborted = true
  activeBatch = null
  for (const pw of workers) {
    if (pw.alive && pw.search !== null) pw.worker.postMessage('stop')
  }
  settle(batch)
}

// Analyzes every fen at the given depth with MultiPV 3, in parallel across the pool.
// Resolves with one EvalResult per position (null = watchdog write-off). Never rejects
// once started; rejects only if not a single pool worker initializes.
export async function analyzeBatch(
  fens: string[],
  depth: number,
  onProgress: (done: number, total: number) => void,
): Promise<(EvalResult | null)[]> {
  abortBatch()
  const seq = ++batchSeq

  // Top up the pool (replaces workers culled by the watchdog or failed inits).
  workers = workers.filter(w => w.alive)
  const target = poolSize()
  while (workers.length < target) workers.push(spawnWorker())
  await Promise.allSettled(workers.map(w => w.ready))
  workers = workers.filter(w => w.alive)

  if (batchSeq !== seq) return new Array<EvalResult | null>(fens.length).fill(null) // superseded during init
  if (workers.length === 0) throw new Error('engine pool: no worker initialized')

  return new Promise<(EvalResult | null)[]>(resolve => {
    const batch: Batch = {
      fens,
      depth,
      movetime: BATCH_MOVETIME_MS[depth] ?? 10000,
      results: new Array<EvalResult | null>(fens.length).fill(null),
      cursor: 0,
      remaining: fens.length,
      done: 0,
      aborted: false,
      settled: false,
      onProgress,
      resolve,
    }
    activeBatch = batch
    for (const pw of workers) pump(pw)
  })
}
