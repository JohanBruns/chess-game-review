import { useState, useCallback, useEffect, useRef } from 'react'
import { analyzeBatch, abortBatch, warmPool } from './enginePool'
import { loadCached, storeCached } from './analysisCache'
import { analyzeTwoPass } from './twoPass'
import { alternativeMoves, cappedAtBest, parseInfoScore, uciToSan, uciPvToSan, type EvalResult } from './uci'

export type { EvalResult } from './uci'

// Whole-game batch analysis: every position gets one single-PV search at the settings depth,
// and the positions whose classification reads the second-best line get a second search for
// it (twoPass.ts) — run in parallel on the enginePool workers (see enginePool.ts), unless the
// per-position IndexedDB cache (analysisCache.ts) already holds the result. The primary worker
// below only serves the interactive paths (evaluate, refinePosition, requestPlayMove).
//
// Publishing is deliberately decoupled from the engines (measured 2026-07): pushing
// evalResults into state after every position re-renders the whole app (move classification
// incl. SEE, puzzles, graph — all O(n) in game length), and a busy main thread delays the
// workers' bestmove delivery, so the render cost lands inside the analysis wall time. Hence:
// during the batch only analysisProgress is published (throttled to PUBLISH_INTERVAL_MS,
// keeping evalResults reference-stable so downstream memos don't recompute); the results land
// in a single evalResults publish when the batch finishes.

interface EngineState {
  isReady: boolean
  isEvaluating: boolean
  isAnalyzing: boolean
  result: EvalResult | null
  evalResults: (EvalResult | null)[]
  analysisProgress: { current: number; total: number } | null
  error: string | null
}

const INITIAL_STATE: EngineState = {
  isReady: false,
  isEvaluating: false,
  isAnalyzing: false,
  result: null,
  evalResults: [],
  analysisProgress: null,
  error: null,
}

type InitPhase = 'uci' | 'isready' | 'ready'

// EngineLines refinement: `alternatives` is the outcome of a search over every move but the
// stored best one, so its lines are the position's 2nd, 3rd, ... best. Fills what the stored
// batch result lacks and keeps what it has — the eval and best move the review was built on,
// and a second line the batch searched itself — so opening the panel never shifts the review.
function withAlternativeLines(fen: string, stored: EvalResult, alternatives: EvalResult): EvalResult {
  const lines: { cp: number; san: string }[] = []
  for (const [cp, san] of [
    [alternatives.cp, alternatives.bestMoveSan],
    [alternatives.secondBestCp, alternatives.secondBestMoveSan],
    [alternatives.thirdBestCp, alternatives.thirdBestMoveSan],
  ] as const) {
    if (cp !== null && san !== null) lines.push({ cp: cappedAtBest(fen, stored.cp, cp), san })
  }
  const second = stored.secondBestMoveSan != null
    ? { cp: stored.secondBestCp, san: stored.secondBestMoveSan }
    : lines[0] ?? null
  const third = lines.find(line => line.san !== second?.san) ?? null
  return {
    ...stored,
    secondBestCp: second?.cp ?? null,
    secondBestMoveSan: second?.san ?? null,
    thirdBestCp: third?.cp ?? null,
    thirdBestMoveSan: third?.san ?? null,
  }
}

// Per-move time cap for the interactive one-off evaluate()/refinePosition() searches, passed
// alongside the depth limit (`go depth D movetime T` stops at whichever limit is hit first).
// The depth limit terminates virtually every search long before the cap; it only reins in
// pathological outlier positions. Keyed by the settings depth (12/15/18 = Fast/Balanced/Deep).
// The batch sweep has its own caps in enginePool.ts.
const SINGLE_MOVETIME_MS: Record<number, number> = { 12: 1500, 15: 3000, 18: 6000 }
const DEFAULT_MOVETIME_MS = 3000
// Grace period after the movetime cap before the watchdog assumes the engine is dead.
const WATCHDOG_GRACE_MS = 2000
// Minimum spacing between analysisProgress publishes during a batch (see the header comment).
// Must comfortably exceed one progress-only app render, or every bestmove arrives into a busy
// main thread and the throttle degenerates into publish-every-position again.
const PUBLISH_INTERVAL_MS = 500

export function useEngine() {
  const [state, setState] = useState<EngineState>(INITIAL_STATE)
  const workerRef = useRef<Worker | null>(null)
  const evaluatingFenRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initPhaseRef = useRef<InitPhase>('uci')
  const depthRef = useRef<number>(15)
  const movetimeRef = useRef<number>(DEFAULT_MOVETIME_MS)
  // True while a pool batch runs — gates the interactive paths (refinePosition/requestPlayMove)
  // and suppresses `result` flicker from a just-superseded single search.
  const batchActiveRef = useRef(false)
  // Bumped whenever a batch starts or is cancelled; stale pool callbacks check it and bail.
  const batchGenRef = useRef(0)
  // The finished batch's results (source of truth for the EngineLines refine-merge).
  const batchResultsRef = useRef<(EvalResult | null)[]>([])
  const lastPublishRef = useRef(0)
  // Single-position refinement (EngineLines on-demand): when set, the running search covers
  // every move but the stored best one, and its bestmove merges the lines it found into
  // evalResults[refineIndex] (withAlternativeLines) instead of becoming `result`.
  const refineIndexRef = useRef<number | null>(null)
  const lastCpRef = useRef<number | null>(null)
  const lastMateRef = useRef<number | null>(null)
  const lastPvRef = useRef<string[]>([])
  const lastSecondBestCpRef = useRef<number | null>(null)
  const lastSecondBestUciRef = useRef<string | null>(null)
  const lastThirdBestCpRef = useRef<number | null>(null)
  const lastThirdBestUciRef = useRef<string | null>(null)
  // Play-out mode (Phase 8): a lightweight second request path — `go movetime` for a single reply
  // instead of the batch `go depth` sweep. When set, the next `bestmove` resolves this instead of
  // touching evalResults/result. Reuses the same worker; only entered after batch analysis is idle.
  const playRequestRef = useRef<((uci: string | null) => void) | null>(null)
  // Number of `go` commands whose `bestmove` reply is still outstanding. The engine answers
  // strictly in order, so when a new request supersedes an in-flight search (its `go` was posted
  // before the previous bestmove arrived — e.g. Analyze Game while an EngineLines refinement is
  // running), the stale replies are recognized by count > 1 and swallowed instead of being
  // attributed to the new search (which would shift every subsequent batch result by one).
  const outstandingGoRef = useRef(0)
  const batchStartRef = useRef(0)

  // Stored in a ref so the timeout callback can call it recursively
  // and the useEffect closure always gets the latest version.
  const postEvalRef = useRef<(fen: string, searchMoves?: string[]) => void>(() => {})

  const postEval = (fen: string, searchMoves?: string[]) => {
    if (!workerRef.current) return
    evaluatingFenRef.current = fen
    lastCpRef.current = null
    lastMateRef.current = null
    lastPvRef.current = []
    lastSecondBestCpRef.current = null
    lastSecondBestUciRef.current = null
    lastThirdBestCpRef.current = null
    lastThirdBestUciRef.current = null
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    const movetime = movetimeRef.current
    workerRef.current.postMessage(`position fen ${fen}`)
    const only = searchMoves && searchMoves.length > 0 ? ` searchmoves ${searchMoves.join(' ')}` : ''
    workerRef.current.postMessage(`go depth ${depthRef.current} movetime ${movetime}${only}`)
    outstandingGoRef.current++
    // `go movetime` self-terminates, so this watchdog only fires if the engine went silent:
    // ask it to stop, and only if even that produces no bestmove (engine truly dead), fail
    // via the inner timer.
    timeoutRef.current = setTimeout(() => {
      workerRef.current?.postMessage('stop')
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        // The search is written off as lost — don't count its (likely never-coming) bestmove.
        outstandingGoRef.current = 0
        refineIndexRef.current = null
        setState(prev => ({
          ...prev,
          isEvaluating: false,
          error: 'Timeout: the engine did not respond in time.',
        }))
      }, WATCHDOG_GRACE_MS)
    }, movetime + WATCHDOG_GRACE_MS)
  }

  // Sync the latest closure into the ref after render (never during render — the
  // worker.onmessage handler and the watchdog timeout both read this ref asynchronously,
  // so they always see this post-commit value).
  useEffect(() => {
    postEvalRef.current = postEval
  })

  useEffect(() => {
    const worker = new Worker('/engine/stockfish-18-lite-single.js')
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data.trim()
      // `info` lines arrive by the thousands during a batch analysis (every depth iteration ×
      // MultiPV line × position) and console.log at that volume measurably slows the analysis
      // with DevTools open — only log the sparse protocol lines (bestmove, init, errors).
      if (import.meta.env.DEV && !line.startsWith('info')) console.log('[SF]', line)

      if (initPhaseRef.current === 'uci' && line === 'uciok') {
        initPhaseRef.current = 'isready'
        worker.postMessage('isready')
        return
      }

      if (initPhaseRef.current === 'isready' && line === 'readyok') {
        initPhaseRef.current = 'ready'
        worker.postMessage('setoption name MultiPV value 3')
        // Sequential whole-game analysis revisits closely related positions; the default 16MB
        // hash thrashes and throws those transposition-table hits away.
        worker.postMessage('setoption name Hash value 128')
        setState(prev => ({ ...prev, isReady: true }))
        // Start the batch workers now, behind the primary engine (which the UI waits for), so
        // they are up by the time a game is loaded and analyzed.
        warmPool()
        return
      }

      if (line.startsWith('info') && line.includes(' score ')) {
        const info = parseInfoScore(line, evaluatingFenRef.current?.split(' ')[1] === 'b')
        if (!info) return
        const { multipvIdx, cp, mate } = info

        if (multipvIdx === 1) {
          lastCpRef.current = cp
          lastMateRef.current = mate
          if (info.pvUci.length > 0) lastPvRef.current = info.pvUci.slice(0, 10)

          // Don't flicker `result` while a pool batch runs (a just-superseded single search
          // may still be streaming info lines on this worker), nor during a refinement — its
          // lines are the alternatives to the best move, not the position's eval.
          if (!batchActiveRef.current && refineIndexRef.current === null) {
            setState(prev => ({
              ...prev,
              result: {
                cp,
                mate,
                bestMoveSan: prev.result?.bestMoveSan ?? null,
                pv: prev.result?.pv ?? null,
                secondBestCp: lastSecondBestCpRef.current,
                secondBestMoveSan: prev.result?.secondBestMoveSan ?? null,
                thirdBestCp: lastThirdBestCpRef.current,
                thirdBestMoveSan: prev.result?.thirdBestMoveSan ?? null,
              },
            }))
          }
        } else if (multipvIdx === 2 && cp !== null) {
          lastSecondBestCpRef.current = cp
          if (info.pvUci.length > 0) lastSecondBestUciRef.current = info.pvUci[0]
        } else if (multipvIdx === 3 && cp !== null) {
          lastThirdBestCpRef.current = cp
          if (info.pvUci.length > 0) lastThirdBestUciRef.current = info.pvUci[0]
        }
        return
      }

      if (line.startsWith('bestmove')) {
        // Superseded-search check FIRST (before touching the watchdog): if a newer `go` is
        // already outstanding, this bestmove belongs to an older, replaced search — swallow it
        // and leave the live search's watchdog alone.
        outstandingGoRef.current = Math.max(0, outstandingGoRef.current - 1)
        if (outstandingGoRef.current > 0) return

        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        const uciMove = line.split(' ')[1]

        // Play-out mode wins over everything: resolve the pending reply and stop — no evalResults
        // or result mutation (the batch analysis / single-eval state must survive a practice game).
        const play = playRequestRef.current
        if (play) {
          playRequestRef.current = null
          setState(prev => ({ ...prev, isEvaluating: false }))
          play(uciMove && uciMove !== '(none)' ? uciMove : null)
          return
        }

        const finalResult: EvalResult = {
          cp: lastCpRef.current,
          mate: lastMateRef.current,
          bestMoveSan: uciToSan(evaluatingFenRef.current, uciMove),
          pv: lastPvRef.current.length > 0 && evaluatingFenRef.current
            ? uciPvToSan(evaluatingFenRef.current, lastPvRef.current)
            : null,
          secondBestCp: lastSecondBestCpRef.current,
          secondBestMoveSan: uciToSan(evaluatingFenRef.current, lastSecondBestUciRef.current),
          thirdBestCp: lastThirdBestCpRef.current,
          thirdBestMoveSan: uciToSan(evaluatingFenRef.current, lastThirdBestUciRef.current),
        }

        // A refinement (EngineLines on-demand): the search covered the alternatives to the
        // stored best move — add its lines to the stored batch result for that position.
        const refineIndex = refineIndexRef.current
        refineIndexRef.current = null
        if (refineIndex != null) {
          const stored = batchResultsRef.current[refineIndex]
          if (!stored) {
            setState(prev => ({ ...prev, isEvaluating: false }))
            return
          }
          const refined = withAlternativeLines(evaluatingFenRef.current ?? '', stored, finalResult)
          batchResultsRef.current[refineIndex] = refined
          setState(prev => {
            const next = { ...prev, isEvaluating: false }
            if (refineIndex < prev.evalResults.length) {
              const merged = [...prev.evalResults]
              merged[refineIndex] = refined
              next.evalResults = merged
            }
            return next
          })
          return
        }

        // Single eval.
        setState(prev => ({ ...prev, isEvaluating: false, result: finalResult }))
      }
    }

    worker.onerror = (e) => {
      setState(prev => ({
        ...prev,
        isEvaluating: false,
        isAnalyzing: false,
        error: `Engine error: ${e.message}`,
      }))
    }

    worker.postMessage('uci')

    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const evaluate = useCallback((fen: string, depth = 15) => {
    if (!workerRef.current) return
    depthRef.current = depth
    movetimeRef.current = SINGLE_MOVETIME_MS[depth] ?? DEFAULT_MOVETIME_MS
    // A single eval supersedes a running batch (parity with the old queue-clearing behavior).
    abortBatch()
    batchGenRef.current++
    batchActiveRef.current = false
    refineIndexRef.current = null
    setState(prev => ({
      ...prev,
      isEvaluating: true,
      isAnalyzing: false,
      analysisProgress: null,
      result: null,
      error: null,
    }))
    postEvalRef.current(fen)
  }, [])

  // EngineLines on-demand: the batch analysis stores the best line and, where the
  // classification needs it, the second — the engine-lines panel wants three. One search over
  // every move but the stored best one supplies the missing lines, merged into
  // evalResults[fenIndex]; the stored eval, best move and batch second line stay as they are.
  // No-op during a batch, without a stored result, or when the best move has no alternative.
  const refinePosition = useCallback((fenIndex: number, fen: string) => {
    if (!workerRef.current || batchActiveRef.current) return
    const stored = batchResultsRef.current[fenIndex]
    if (!stored) return
    const alternatives = alternativeMoves(fen, stored.bestMoveSan)
    if (alternatives.length === 0) return
    movetimeRef.current = SINGLE_MOVETIME_MS[depthRef.current] ?? DEFAULT_MOVETIME_MS
    refineIndexRef.current = fenIndex
    setState(prev => ({ ...prev, isEvaluating: true, error: null }))
    postEvalRef.current(fen, alternatives)
  }, [])

  const clearAnalysis = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    abortBatch()
    batchGenRef.current++
    batchActiveRef.current = false
    batchResultsRef.current = []
    refineIndexRef.current = null
    setState(prev => ({
      ...prev,
      evalResults: [],
      result: null,
      isAnalyzing: false,
      isEvaluating: false,
      analysisProgress: null,
      error: null,
    }))
  }, [])

  // `selectCandidates` names the positions whose second-best line the review reads, given the
  // first-pass results (analysis/candidates.ts) — only those get a second search.
  const analyzeGame = useCallback((
    fens: string[],
    depth = 15,
    selectCandidates: (firstPass: (EvalResult | null)[]) => number[] = () => [],
  ) => {
    if (fens.length === 0) return
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    depthRef.current = depth
    batchStartRef.current = performance.now()
    refineIndexRef.current = null
    batchResultsRef.current = new Array(fens.length).fill(null)
    lastPublishRef.current = performance.now()
    // End a possibly in-flight single search on the primary worker quickly; its bestmove is
    // swallowed via the outstanding-go counter.
    if (outstandingGoRef.current > 0) workerRef.current?.postMessage('stop')
    const gen = ++batchGenRef.current
    batchActiveRef.current = true
    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      isEvaluating: false,
      result: null,
      error: null,
      evalResults: new Array(fens.length).fill(null),
      analysisProgress: { current: 0, total: fens.length },
    }))
    const finish = (results: (EvalResult | null)[], fromCache: number) => {
      batchActiveRef.current = false
      batchResultsRef.current = results
      if (import.meta.env.DEV) {
        console.log('[SF] batch analysis:', fens.length, 'positions (', fromCache,
          'from cache ) in', Math.round(performance.now() - batchStartRef.current), 'ms')
      }
      setState(prev => ({
        ...prev,
        evalResults: [...results],
        isAnalyzing: false,
        isEvaluating: false,
        analysisProgress: null,
      }))
    }
    // Cached positions (see analysisCache.ts) skip the engine; only the misses go to the pool,
    // and progress counts the cache hits as already done.
    loadCached(fens, depth).then(cached => {
      if (batchGenRef.current !== gen) return undefined // aborted or superseded during lookup
      const fromCache = cached.filter(r => r != null).length
      return analyzeTwoPass({
        fens,
        known: cached,
        selectCandidates,
        runBatch: (jobs, onDone) => analyzeBatch(jobs, depth, onDone),
        isCancelled: () => batchGenRef.current !== gen,
        onProgress: fraction => {
          if (batchGenRef.current !== gen) return
          // Throttled progress-only publish — see the header comment: evalResults stays
          // reference-stable during the batch so the O(n) memo chain never recomputes mid-run.
          const now = performance.now()
          if (now - lastPublishRef.current >= PUBLISH_INTERVAL_MS) {
            lastPublishRef.current = now
            const current = fromCache + Math.floor(fraction * (fens.length - fromCache))
            setState(prev => ({ ...prev, analysisProgress: { current, total: fens.length } }))
          }
        },
      }).then(outcome => {
        if (!outcome || batchGenRef.current !== gen) return // aborted or superseded
        const { results, changed } = outcome
        void storeCached(changed.map(i => fens[i]), depth, changed.map(i => results[i]))
        finish(results, fromCache)
      })
    }).catch(() => {
      if (batchGenRef.current !== gen) return
      batchActiveRef.current = false
      setState(prev => ({
        ...prev,
        isAnalyzing: false,
        analysisProgress: null,
        error: 'Engine error: analysis workers failed to start.',
      }))
    })
  }, [])

  // Play-out reply for a single position (Phase 8 "Practice from here"). Resolves with the
  // engine's move in UCI, or null if it can't run (not ready, a batch analysis is in flight, or
  // the watchdog fired). Deliberately does NOT go through postEval — it uses `go movetime` for a
  // fast, shallow reply and never records the position into evalResults.
  const requestPlayMove = useCallback((fen: string, movetimeMs = 500): Promise<string | null> => {
    return new Promise((resolve) => {
      const worker = workerRef.current
      if (!worker || !state.isReady || batchActiveRef.current) {
        resolve(null)
        return
      }
      if (playRequestRef.current) playRequestRef.current(null) // supersede any stale request
      playRequestRef.current = resolve
      refineIndexRef.current = null // a superseded in-flight refinement must not merge later
      evaluatingFenRef.current = fen
      lastCpRef.current = null
      lastMateRef.current = null
      lastPvRef.current = []
      lastSecondBestCpRef.current = null
      lastSecondBestUciRef.current = null
      lastThirdBestCpRef.current = null
      lastThirdBestUciRef.current = null
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
      setState(prev => ({ ...prev, isEvaluating: true, error: null }))
      worker.postMessage(`position fen ${fen}`)
      worker.postMessage(`go movetime ${movetimeMs}`)
      outstandingGoRef.current++
      // Watchdog: `go movetime` self-terminates, but force a stop + null-resolve if it goes silent.
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        worker.postMessage('stop')
        outstandingGoRef.current = 0 // search written off — don't count its bestmove anymore
        const pending = playRequestRef.current
        if (pending) {
          playRequestRef.current = null
          setState(prev => ({ ...prev, isEvaluating: false }))
          pending(null)
        }
      }, movetimeMs + 3000)
    })
  }, [state.isReady])

  return {
    isReady: state.isReady,
    isEvaluating: state.isEvaluating,
    isAnalyzing: state.isAnalyzing,
    result: state.result,
    evalResults: state.evalResults,
    analysisProgress: state.analysisProgress,
    error: state.error,
    evaluate,
    analyzeGame,
    clearAnalysis,
    refinePosition,
    requestPlayMove,
  }
}
