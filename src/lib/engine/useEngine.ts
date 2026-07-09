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

interface AnalysisQueue {
  fens: string[]
  index: number
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

// Watchdog duration per search depth — deeper searches legitimately take longer, so a flat
// timeout would either time out valid depth-18 searches or waste time waiting at depth 12.
const DEPTH_TIMEOUT_MS: Record<number, number> = { 12: 7000, 15: 10000, 18: 20000 }

export function useEngine() {
  const [state, setState] = useState<EngineState>(INITIAL_STATE)
  const workerRef = useRef<Worker | null>(null)
  const evaluatingFenRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initPhaseRef = useRef<InitPhase>('uci')
  const depthRef = useRef<number>(15)
  const analysisQueueRef = useRef<AnalysisQueue | null>(null)
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
    workerRef.current.postMessage(`position fen ${fen}`)
    workerRef.current.postMessage(`go depth ${depthRef.current}`)
    timeoutRef.current = setTimeout(() => {
      workerRef.current?.postMessage('stop')
      timeoutRef.current = null
      const queue = analysisQueueRef.current
      if (queue) {
        const next = queue.index + 1
        if (next < queue.fens.length) {
          analysisQueueRef.current = { ...queue, index: next }
          setState(prev => ({
            ...prev,
            analysisProgress: { current: next, total: queue.fens.length },
          }))
          postEvalRef.current(queue.fens[next])
        } else {
          analysisQueueRef.current = null
          setState(prev => ({
            ...prev,
            isAnalyzing: false,
            isEvaluating: false,
            analysisProgress: null,
          }))
        }
      } else {
        setState(prev => ({
          ...prev,
          isEvaluating: false,
          error: 'Timeout: the engine did not respond in time.',
        }))
      }
    }, DEPTH_TIMEOUT_MS[depthRef.current] ?? 10_000)
  }
  // Sync the latest postEval closure into the ref after render (never during render — the
  // worker.onmessage handler and the analysis-queue timeout both read postEvalRef.current
  // asynchronously, so they always see this post-commit value).
  useEffect(() => {
    postEvalRef.current = postEval
  })

  useEffect(() => {
    const worker = new Worker('/engine/stockfish-18-lite-single.js')
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data.trim()
      if (import.meta.env.DEV) console.log('[SF]', line)

      if (initPhaseRef.current === 'uci' && line === 'uciok') {
        initPhaseRef.current = 'isready'
        worker.postMessage('isready')
        return
      }

      if (initPhaseRef.current === 'isready' && line === 'readyok') {
        initPhaseRef.current = 'ready'
        worker.postMessage('setoption name MultiPV value 3')
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

        const queue = analysisQueueRef.current
        if (queue) {
          const next = queue.index + 1
          setState(prev => {
            const newResults = [...prev.evalResults]
            newResults[queue.index] = finalResult
            if (next < queue.fens.length) {
              return {
                ...prev,
                evalResults: newResults,
                analysisProgress: { current: next, total: queue.fens.length },
              }
            }
            return {
              ...prev,
              evalResults: newResults,
              isAnalyzing: false,
              isEvaluating: false,
              analysisProgress: null,
            }
          })
          if (next < queue.fens.length) {
            analysisQueueRef.current = { ...queue, index: next }
            postEvalRef.current(queue.fens[next])
          } else {
            analysisQueueRef.current = null
          }
        } else {
          setState(prev => ({
            ...prev,
            isEvaluating: false,
            result: finalResult,
          }))
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
    analysisQueueRef.current = null
    setState(prev => ({ ...prev, isEvaluating: true, isAnalyzing: false, result: null, error: null }))
    postEvalRef.current(fen)
  }, [])

  const clearAnalysis = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    analysisQueueRef.current = null
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
    analysisQueueRef.current = { fens, index: 0 }
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
      // Watchdog: `go movetime` self-terminates, but force a stop + null-resolve if it goes silent.
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        worker.postMessage('stop')
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
    requestPlayMove,
  }
}
