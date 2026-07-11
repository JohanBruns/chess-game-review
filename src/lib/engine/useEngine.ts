import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'

export interface EvalResult {
  cp: number | null
  mate: number | null
  bestMoveSan: string | null
  pv: string | null
  secondBestCp: number | null
  secondBestMoveSan: string | null
  thirdBestCp: number | null
  thirdBestMoveSan: string | null
}

// Single-pass batch analysis: every position gets one MultiPV-3 search at the settings depth.
// The engine finishes such a search in tens to a few hundred ms — what actually dominated the
// wall time (measured 2026-07) was the MAIN thread: publishing evalResults after every position
// re-renders the whole app (move classification incl. SEE, puzzles, graph — all O(n) in game
// length), and that render blocks the delivery of the next bestmove from the worker, so its
// cost lands inside the next search's turnaround. A two-pass sweep+refine variant made this
// 3-4× worse (every refine publish paid a full-size render) and was reverted. Hence: during
// the batch only analysisProgress is published (throttled to PUBLISH_INTERVAL_MS, keeping
// evalResults reference-stable so downstream memos don't recompute); the results land in a
// single evalResults publish when the batch finishes.
interface AnalysisQueue {
  fens: string[]
  pos: number
}

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

// Per-move time caps, passed alongside the depth limit (`go depth D movetime T` stops at
// whichever limit is hit first). The depth limit terminates virtually every search long before
// these caps; they only rein in pathological outlier positions. Keyed by the settings depth
// (12/15/18 = the Fast/Balanced/Deep presets).
//
// SINGLE_MOVETIME_MS: interactive one-off evaluate()/refinePosition() calls.
// BATCH_MOVETIME_MS: the whole-game sweep — generous, so outliers cost seconds, not minutes.
const SINGLE_MOVETIME_MS: Record<number, number> = { 12: 1500, 15: 3000, 18: 6000 }
const BATCH_MOVETIME_MS: Record<number, number> = { 12: 7000, 15: 10000, 18: 20000 }
const DEFAULT_MOVETIME_MS = 3000
// Grace period after the movetime cap before the watchdog assumes the engine is dead.
const WATCHDOG_GRACE_MS = 2000
// Minimum spacing between analysisProgress publishes during a batch (see AnalysisQueue
// comment). Must comfortably exceed one progress-only app render, or every bestmove arrives
// into a busy main thread and the throttle degenerates into publish-every-position again.
const PUBLISH_INTERVAL_MS = 500

export function useEngine() {
  const [state, setState] = useState<EngineState>(INITIAL_STATE)
  const workerRef = useRef<Worker | null>(null)
  const evaluatingFenRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initPhaseRef = useRef<InitPhase>('uci')
  const depthRef = useRef<number>(15)
  const movetimeRef = useRef<number>(DEFAULT_MOVETIME_MS)
  const analysisQueueRef = useRef<AnalysisQueue | null>(null)
  // Batch results accumulate here (source of truth during a batch); state.evalResults is a
  // throttled published copy (see PUBLISH_INTERVAL_MS).
  const batchResultsRef = useRef<(EvalResult | null)[]>([])
  const lastPublishRef = useRef(0)
  // Single-position refinement (EngineLines on-demand): when set, the next single-eval
  // bestmove also merges its result into evalResults[refineIndex].
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
  const postEvalRef = useRef<(fen: string) => void>(() => {})

  const postEval = (fen: string) => {
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
    workerRef.current.postMessage(`go depth ${depthRef.current} movetime ${movetime}`)
    outstandingGoRef.current++
    // `go movetime` self-terminates, so this watchdog only fires if the engine went silent.
    // It must NOT advance the queue itself: the stopped search still emits `bestmove`, and if
    // the queue had already moved on, that late bestmove would be attributed to the wrong
    // position and advance the queue a second time. So: ask the engine to stop, and only if
    // even that produces no bestmove (engine truly dead), fail via the inner timer.
    timeoutRef.current = setTimeout(() => {
      workerRef.current?.postMessage('stop')
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        // The search is written off as lost — don't count its (likely never-coming) bestmove.
        outstandingGoRef.current = 0
        if (analysisQueueRef.current) {
          advanceBatchRef.current(null)
        } else {
          refineIndexRef.current = null
          setState(prev => ({
            ...prev,
            isEvaluating: false,
            error: 'Timeout: the engine did not respond in time.',
          }))
        }
      }, WATCHDOG_GRACE_MS)
    }, movetime + WATCHDOG_GRACE_MS)
  }
  // Records one finished batch search (finalResult, or null when the engine died on it) and
  // moves the batch forward: next position, or finish. Called from the bestmove handler and
  // from the dead-engine failsafe in postEval — never from both for the same search, since the
  // failsafe only fires when no bestmove arrived.
  const advanceBatchRef = useRef<(finalResult: EvalResult | null) => void>(() => {})

  const advanceBatch = (finalResult: EvalResult | null) => {
    const queue = analysisQueueRef.current
    if (!queue) return
    if (finalResult) batchResultsRef.current[queue.pos] = finalResult
    const nextPos = queue.pos + 1

    if (nextPos < queue.fens.length) {
      analysisQueueRef.current = { ...queue, pos: nextPos }
      // Intermediate publishes update ONLY analysisProgress: evalResults stays reference-stable
      // so the O(n) memo chain (move analyses/puzzles/graph) never recomputes mid-batch, and the
      // remaining app re-render is flat-cost. Publishing evalResults here would grow the render
      // past any throttle interval and re-create the stall this design exists to avoid — the
      // full results land in one publish at batch end.
      const now = performance.now()
      if (now - lastPublishRef.current >= PUBLISH_INTERVAL_MS) {
        lastPublishRef.current = now
        setState(prev => ({
          ...prev,
          analysisProgress: { current: nextPos, total: queue.fens.length },
        }))
      }
      postEvalRef.current(queue.fens[nextPos])
      return
    }

    if (import.meta.env.DEV) {
      console.log('[SF] batch analysis:', queue.fens.length, 'positions in',
        Math.round(performance.now() - batchStartRef.current), 'ms')
    }
    analysisQueueRef.current = null
    setState(prev => ({
      ...prev,
      evalResults: [...batchResultsRef.current],
      isAnalyzing: false,
      isEvaluating: false,
      analysisProgress: null,
    }))
  }

  // Sync the latest closures into their refs after render (never during render — the
  // worker.onmessage handler and the analysis-queue timeout both read these refs
  // asynchronously, so they always see this post-commit value).
  useEffect(() => {
    postEvalRef.current = postEval
    advanceBatchRef.current = advanceBatch
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
        return
      }

      if (line.startsWith('info') && line.includes(' score ')) {
        const multipvMatch = line.match(/multipv (\d+)/)
        const multipvIdx = multipvMatch ? parseInt(multipvMatch[1], 10) : 1

        const cpMatch = line.match(/score cp (-?\d+)/)
        const mateMatch = line.match(/score mate (-?\d+)/)
        const rawCp = cpMatch ? parseInt(cpMatch[1], 10) : null
        const rawMate = mateMatch ? parseInt(mateMatch[1], 10) : null

        const isBlackToMove = evaluatingFenRef.current?.split(' ')[1] === 'b'
        // Any mate score (not just mate=0, the "already checkmated" edge case) converts
        // to a signed ±10000 cp sentinel so evalToCp/secondBestCp never see an ambiguous
        // null. rawMate > 0 means the side to move delivers mate (good, +10000 for them);
        // rawMate <= 0 means they get mated (bad, -10000). Then flip into White-absolute
        // perspective like rawCp. Applied uniformly so multipv 2 ("2nd best") lines that
        // lead to forced mate also get a usable secondBestCp instead of staying null.
        const cpFromMate = rawMate !== null
          ? (isBlackToMove ? -1 : 1) * (rawMate > 0 ? 10000 : -10000)
          : null
        const cp = rawCp !== null ? (isBlackToMove ? -rawCp : rawCp) : cpFromMate
        const mate = rawMate !== null && rawMate !== 0 ? (isBlackToMove ? -rawMate : rawMate) : null

        if (multipvIdx === 1) {
          lastCpRef.current = cp
          lastMateRef.current = mate
          const pvMatch = line.match(/ pv (.+)$/)
          if (pvMatch) lastPvRef.current = pvMatch[1].trim().split(' ').slice(0, 10)

          // Skip intermediate state updates during batch analysis to avoid excessive re-renders
          if (!analysisQueueRef.current) {
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
          const pvMatch = line.match(/ pv (\S+)/)
          if (pvMatch) lastSecondBestUciRef.current = pvMatch[1]
        } else if (multipvIdx === 3 && cp !== null) {
          lastThirdBestCpRef.current = cp
          const pvMatch = line.match(/ pv (\S+)/)
          if (pvMatch) lastThirdBestUciRef.current = pvMatch[1]
        }
        return
      }

      if (line.startsWith('bestmove')) {
        // Superseded-search check FIRST (before touching the watchdog): if a newer `go` is
        // already outstanding, this bestmove belongs to an older, replaced search — swallow it
        // and leave the live search's watchdog alone.
        outstandingGoRef.current = Math.max(0, outstandingGoRef.current - 1)
        if (outstandingGoRef.current > 0) return

        function uciPvToSan(fen: string, uciMoves: string[]): string {
          const chess = new Chess(fen)
          const sans: string[] = []
          for (const uci of uciMoves) {
            try {
              const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
              if (m) sans.push(m.san); else break
            } catch { break }
          }
          return sans.join(' ')
        }
        // Single-move UCI → SAN, used for the best move and the 2nd/3rd MultiPV lines' first move.
        function uciToSan(fen: string | null, uci: string | null): string | null {
          if (!uci || uci === '(none)' || !fen) return null
          try {
            const chess = new Chess(fen)
            const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? undefined })
            return m?.san ?? null
          } catch {
            return null
          }
        }
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

        const bestMoveSan = uciToSan(evaluatingFenRef.current, uciMove)

        const pv = lastPvRef.current.length > 0 && evaluatingFenRef.current
          ? uciPvToSan(evaluatingFenRef.current, lastPvRef.current)
          : null

        const finalResult: EvalResult = {
          cp: lastCpRef.current,
          mate: lastMateRef.current,
          bestMoveSan,
          pv,
          secondBestCp: lastSecondBestCpRef.current,
          secondBestMoveSan: uciToSan(evaluatingFenRef.current, lastSecondBestUciRef.current),
          thirdBestCp: lastThirdBestCpRef.current,
          thirdBestMoveSan: uciToSan(evaluatingFenRef.current, lastThirdBestUciRef.current),
        }

        if (analysisQueueRef.current) {
          advanceBatchRef.current(finalResult)
        } else {
          // Single eval — optionally a refinement (EngineLines on-demand): merge the fresh
          // MultiPV result into the stored batch result for that position as well.
          const refineIndex = refineIndexRef.current
          refineIndexRef.current = null
          if (refineIndex != null && refineIndex < batchResultsRef.current.length) {
            batchResultsRef.current[refineIndex] = finalResult
          }
          setState(prev => {
            const next = { ...prev, isEvaluating: false, result: finalResult }
            if (refineIndex != null && refineIndex < prev.evalResults.length) {
              const merged = [...prev.evalResults]
              merged[refineIndex] = finalResult
              next.evalResults = merged
            }
            return next
          })
        }
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
    analysisQueueRef.current = null
    refineIndexRef.current = null
    setState(prev => ({ ...prev, isEvaluating: true, isAnalyzing: false, result: null, error: null }))
    postEvalRef.current(fen)
  }, [])

  // EngineLines on-demand: a single MultiPV-3 search whose result is also merged into
  // evalResults[fenIndex] — used when the stored result for the current position lacks the
  // 2nd/3rd lines the engine-lines panel needs (e.g. a watchdog-stopped batch search).
  // No-op during a batch.
  const refinePosition = useCallback((fenIndex: number, fen: string) => {
    if (!workerRef.current || analysisQueueRef.current) return
    movetimeRef.current = SINGLE_MOVETIME_MS[depthRef.current] ?? DEFAULT_MOVETIME_MS
    refineIndexRef.current = fenIndex
    setState(prev => ({ ...prev, isEvaluating: true, error: null }))
    postEvalRef.current(fen)
  }, [])

  const clearAnalysis = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    analysisQueueRef.current = null
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

  const analyzeGame = useCallback((fens: string[], depth = 15) => {
    if (!workerRef.current || fens.length === 0) return
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    depthRef.current = depth
    movetimeRef.current = BATCH_MOVETIME_MS[depth] ?? 10000
    batchStartRef.current = performance.now()
    refineIndexRef.current = null
    batchResultsRef.current = new Array(fens.length).fill(null)
    lastPublishRef.current = performance.now()
    // End a possibly in-flight single search quickly; its bestmove is swallowed via the
    // outstanding-go counter instead of being misattributed to the batch's first position.
    if (outstandingGoRef.current > 0) workerRef.current.postMessage('stop')
    analysisQueueRef.current = { fens, pos: 0 }
    setState(prev => ({
      ...prev,
      isAnalyzing: true,
      isEvaluating: false,
      result: null,
      error: null,
      evalResults: new Array(fens.length).fill(null),
      analysisProgress: { current: 0, total: fens.length },
    }))
    postEvalRef.current(fens[0])
  }, [])

  // Play-out reply for a single position (Phase 8 "Practice from here"). Resolves with the
  // engine's move in UCI, or null if it can't run (not ready, a batch analysis is in flight, or
  // the watchdog fired). Deliberately does NOT go through postEval — it uses `go movetime` for a
  // fast, shallow reply and never records the position into evalResults.
  const requestPlayMove = useCallback((fen: string, movetimeMs = 500): Promise<string | null> => {
    return new Promise((resolve) => {
      const worker = workerRef.current
      if (!worker || !state.isReady || analysisQueueRef.current) {
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
