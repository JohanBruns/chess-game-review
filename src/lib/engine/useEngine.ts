import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'

export interface EvalResult {
  cp: number | null
  mate: number | null
  bestMoveSan: string | null
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

export function useEngine() {
  const [state, setState] = useState<EngineState>(INITIAL_STATE)
  const workerRef = useRef<Worker | null>(null)
  const evaluatingFenRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initPhaseRef = useRef<InitPhase>('uci')
  const analysisQueueRef = useRef<AnalysisQueue | null>(null)
  const lastCpRef = useRef<number | null>(null)
  const lastMateRef = useRef<number | null>(null)

  // Stored in a ref so the timeout callback can call it recursively
  // and the useEffect closure always gets the latest version.
  const postEvalRef = useRef<(fen: string) => void>(() => {})

  const postEval = (fen: string) => {
    if (!workerRef.current) return
    evaluatingFenRef.current = fen
    lastCpRef.current = null
    lastMateRef.current = null
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    workerRef.current.postMessage(`position fen ${fen}`)
    workerRef.current.postMessage('go depth 15')
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
          error: 'Timeout: Engine hat nicht rechtzeitig geantwortet.',
        }))
      }
    }, 10_000)
  }
  postEvalRef.current = postEval

  useEffect(() => {
    const worker = new Worker('/engine/stockfish-18-lite-single.js')
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<string>) => {
      const line = e.data.trim()
      console.log('[SF]', line)

      if (initPhaseRef.current === 'uci' && line === 'uciok') {
        initPhaseRef.current = 'isready'
        worker.postMessage('isready')
        return
      }

      if (initPhaseRef.current === 'isready' && line === 'readyok') {
        initPhaseRef.current = 'ready'
        setState(prev => ({ ...prev, isReady: true }))
        return
      }

      if (line.startsWith('info') && line.includes(' score ')) {
        const cpMatch = line.match(/score cp (-?\d+)/)
        const mateMatch = line.match(/score mate (-?\d+)/)
        const rawCp = cpMatch ? parseInt(cpMatch[1], 10) : null
        const rawMate = mateMatch ? parseInt(mateMatch[1], 10) : null

        const isBlackToMove = evaluatingFenRef.current?.split(' ')[1] === 'b'
        const cp = rawCp !== null ? (isBlackToMove ? -rawCp : rawCp) : null
        const mate = rawMate !== null ? (isBlackToMove ? -rawMate : rawMate) : null

        lastCpRef.current = cp
        lastMateRef.current = mate

        // Skip intermediate state updates during batch analysis to avoid excessive re-renders
        if (!analysisQueueRef.current) {
          setState(prev => ({
            ...prev,
            result: { cp, mate, bestMoveSan: prev.result?.bestMoveSan ?? null },
          }))
        }
        return
      }

      if (line.startsWith('bestmove')) {
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        const uciMove = line.split(' ')[1]
        let bestMoveSan: string | null = null
        if (uciMove && uciMove !== '(none)' && evaluatingFenRef.current) {
          try {
            const chess = new Chess(evaluatingFenRef.current)
            const m = chess.move({
              from: uciMove.slice(0, 2),
              to: uciMove.slice(2, 4),
              promotion: uciMove[4] ?? undefined,
            })
            bestMoveSan = m?.san ?? null
          } catch {
            bestMoveSan = null
          }
        }

        const finalResult: EvalResult = {
          cp: lastCpRef.current,
          mate: lastMateRef.current,
          bestMoveSan,
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
        error: `Engine-Fehler: ${e.message}`,
      }))
    }

    worker.postMessage('uci')

    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const evaluate = useCallback((fen: string) => {
    if (!workerRef.current) return
    analysisQueueRef.current = null
    setState(prev => ({ ...prev, isEvaluating: true, isAnalyzing: false, result: null, error: null }))
    postEvalRef.current(fen)
  }, [])

  const analyzeGame = useCallback((fens: string[]) => {
    if (!workerRef.current || fens.length === 0) return
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
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
  }
}
