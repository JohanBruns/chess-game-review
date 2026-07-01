import type { EvalResult } from '../lib/engine/useEngine'

interface EvalPanelProps {
  isReady: boolean
  isEvaluating: boolean
  isAnalyzing: boolean
  analysisProgress: { current: number; total: number } | null
  result: EvalResult | null
  error: string | null
  isGameLoaded: boolean
  whiteAccuracy: number | null
  blackAccuracy: number | null
  onEvaluate: () => void
  onAnalyzeGame: () => void
}

function formatEval(result: EvalResult): string {
  if (result.mate !== null) {
    return `Mate in ${Math.abs(result.mate)}`
  }
  if (result.cp !== null) {
    if (result.cp >= 10000) return 'Mate (+)'
    if (result.cp <= -10000) return 'Mate (-)'
    const pawns = result.cp / 100
    return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1)
  }
  return '—'
}

export function EvalPanel({
  isReady,
  isEvaluating,
  isAnalyzing,
  analysisProgress,
  result,
  error,
  isGameLoaded,
  whiteAccuracy,
  blackAccuracy,
  onEvaluate,
  onAnalyzeGame,
}: EvalPanelProps) {
  const busy = isEvaluating || isAnalyzing
  const evalDisabled = !isReady || !isGameLoaded || busy
  const analyzeDisabled = !isReady || !isGameLoaded || busy

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={onEvaluate}
          disabled={evalDisabled}
          className="flex-1 px-3 py-2 rounded bg-cc-green-dark hover:bg-cc-green disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          Evaluate Position
        </button>
        <button
          onClick={onAnalyzeGame}
          disabled={analyzeDisabled}
          className="flex-1 px-3 py-2 rounded bg-cc-green hover:bg-cc-green-hover disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          Analyze Game
        </button>
      </div>

      {isAnalyzing && analysisProgress && (
        <div className="flex flex-col gap-1">
          <p className="text-cc-text-dim text-sm animate-pulse">
            Analyzing… Move {Math.ceil(analysisProgress.current / 2)} /{' '}
            {Math.ceil(analysisProgress.total / 2)}
          </p>
          <div className="w-full bg-cc-surface rounded-full h-1.5">
            <div
              className="bg-cc-green h-1.5 rounded-full transition-all duration-200"
              style={{
                width: `${(analysisProgress.current / analysisProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {isEvaluating && (
        <p className="text-cc-text-dim text-sm animate-pulse">Evaluating…</p>
      )}

      {!busy && result && (
        <div className="flex justify-between text-sm px-1">
          <span className="font-semibold">{formatEval(result)}</span>
          {result.bestMoveSan && (
            <span className="font-mono text-cc-text-dim">
              Best move: {result.bestMoveSan}
            </span>
          )}
        </div>
      )}

      {whiteAccuracy !== null && blackAccuracy !== null && (
        <div className="flex justify-between text-sm px-1 py-1 bg-cc-panel rounded">
          <span>
            <span className="text-cc-text-dim">White </span>
            <span className="font-semibold text-white">{whiteAccuracy.toFixed(1)}%</span>
          </span>
          <span>
            <span className="text-cc-text-dim">Black </span>
            <span className="font-semibold text-cc-text-dim">{blackAccuracy.toFixed(1)}%</span>
          </span>
        </div>
      )}

      {error && <p className="text-cc-red text-xs px-1">{error}</p>}
    </div>
  )
}
