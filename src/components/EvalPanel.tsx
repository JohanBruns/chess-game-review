import type { EvalResult } from '../lib/engine/useEngine'

interface EvalPanelProps {
  isReady: boolean
  isAnalyzing: boolean
  analysisProgress: { current: number; total: number } | null
  result: EvalResult | null
  error: string | null
  isGameLoaded: boolean
  whiteAccuracy: number | null
  blackAccuracy: number | null
  whitePhaseAccuracy?: { opening: number | null; middlegame: number | null; endgame: number | null } | null
  blackPhaseAccuracy?: { opening: number | null; middlegame: number | null; endgame: number | null } | null
  onAnalyzeGame: () => void
}

function formatPhase(v: number | null): string {
  return v === null ? '–' : v.toFixed(1)
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
  whiteAccuracy,
  blackAccuracy,
  whitePhaseAccuracy,
  blackPhaseAccuracy,
  onAnalyzeGame,
}: EvalPanelProps) {
  const analyzeDisabled = !isReady || !isGameLoaded || isAnalyzing

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

      {whitePhaseAccuracy && blackPhaseAccuracy && (
        <div className="grid grid-cols-4 gap-1 text-xs px-1 py-1 bg-cc-panel rounded text-center">
          <span></span>
          <span className="text-cc-text-dim">Open</span>
          <span className="text-cc-text-dim">Mid</span>
          <span className="text-cc-text-dim">End</span>

          <span className="text-cc-text-dim text-left">White</span>
          <span className="font-semibold text-white">{formatPhase(whitePhaseAccuracy.opening)}</span>
          <span className="font-semibold text-white">{formatPhase(whitePhaseAccuracy.middlegame)}</span>
          <span className="font-semibold text-white">{formatPhase(whitePhaseAccuracy.endgame)}</span>

          <span className="text-cc-text-dim text-left">Black</span>
          <span className="font-semibold text-cc-text-dim">{formatPhase(blackPhaseAccuracy.opening)}</span>
          <span className="font-semibold text-cc-text-dim">{formatPhase(blackPhaseAccuracy.middlegame)}</span>
          <span className="font-semibold text-cc-text-dim">{formatPhase(blackPhaseAccuracy.endgame)}</span>
        </div>
      )}

      {error && <p className="text-cc-red text-xs px-1">{error}</p>}
    </div>
  )
}
