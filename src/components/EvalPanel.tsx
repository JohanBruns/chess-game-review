import type { EvalResult } from '../lib/engine/useEngine'
import type { EngineLine } from '../lib/analysis/lines'
import { EngineLines } from './EngineLines'

interface EvalPanelProps {
  isReady: boolean
  isAnalyzing: boolean
  analysisProgress: { current: number; total: number } | null
  result: EvalResult | null
  error: string | null
  isGameLoaded: boolean
  // True once an analysis has been started/completed for the loaded game — keeps the
  // Analyze button greyed out after its one allowed click (resets on loading a new game).
  hasAnalysis: boolean
  onAnalyzeGame: () => void
  // Candidate moves for the current position (settings.showEngineLines) — empty when the
  // setting is off or no analysis is available yet for this ply.
  engineLines?: EngineLine[]
  onHoverEngineLine?: (san: string | null) => void
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
  isAnalyzing,
  analysisProgress,
  result,
  error,
  isGameLoaded,
  hasAnalysis,
  onAnalyzeGame,
  engineLines = [],
  onHoverEngineLine,
}: EvalPanelProps) {
  const analyzeDisabled = !isReady || !isGameLoaded || isAnalyzing || hasAnalysis

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
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

      {!isAnalyzing && result && (
        <div className="flex justify-between text-sm px-1">
          <span className="font-semibold">{formatEval(result)}</span>
          {result.bestMoveSan && (
            <span className="font-mono text-cc-text-dim">
              Best move: {result.bestMoveSan}
            </span>
          )}
        </div>
      )}

      {error && <p className="text-cc-red text-xs px-1">{error}</p>}

      {onHoverEngineLine && <EngineLines lines={engineLines} onHoverLine={onHoverEngineLine} />}
    </div>
  )
}
