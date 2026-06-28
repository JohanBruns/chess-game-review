import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'

export interface EvalResult {
  cp: number | null
  mate: number | null
  bestMoveSan: string | null
}

interface EngineState {
  isReady: boolean
  isEvaluating: boolean
  result: EvalResult | null
  error: string | null
}

const INITIAL_STATE: EngineState = {
  isReady: false,
  isEvaluating: false,
  result: null,
  error: null,
}

type InitPhase = 'uci' | 'isready' | 'ready'

export function useEngine() {
  const [state, setState] = useState<EngineState>(INITIAL_STATE)
  const workerRef = useRef<Worker | null>(null)
  const evaluatingFenRef = useRef<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initPhaseRef = useRef<InitPhase>('uci')

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

        setState(prev => ({
          ...prev,
          result: { cp, mate, bestMoveSan: prev.result?.bestMoveSan ?? null },
        }))
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
        setState(prev => ({
          ...prev,
          isEvaluating: false,
          result: prev.result
            ? { ...prev.result, bestMoveSan }
            : { cp: null, mate: null, bestMoveSan },
        }))
      }
    }

    worker.onerror = (e) => {
      setState(prev => ({
        ...prev,
        isEvaluating: false,
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
    evaluatingFenRef.current = fen
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    setState(prev => ({ ...prev, isEvaluating: true, result: null, error: null }))
    workerRef.current.postMessage(`position fen ${fen}`)
    workerRef.current.postMessage('go depth 15')
    timeoutRef.current = setTimeout(() => {
      workerRef.current?.postMessage('stop')
      setState(prev => ({
        ...prev,
        isEvaluating: false,
        error: 'Timeout: Engine hat nicht rechtzeitig geantwortet.',
      }))
      timeoutRef.current = null
    }, 10_000)
  }, [])

  return {
    isReady: state.isReady,
    isEvaluating: state.isEvaluating,
    result: state.result,
    error: state.error,
    evaluate,
  }
}
