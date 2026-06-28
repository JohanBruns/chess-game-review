import type { EvalResult } from '../lib/engine/useEngine'

interface EvalPanelProps {
  isReady: boolean
  isEvaluating: boolean
  result: EvalResult | null
  error: string | null
  isGameLoaded: boolean
  onEvaluate: () => void
}

function formatEval(result: EvalResult): string {
  if (result.mate !== null) {
    return `Matt in ${Math.abs(result.mate)}`
  }
  if (result.cp !== null) {
    const pawns = result.cp / 100
    return pawns >= 0 ? `+${pawns.toFixed(1)}` : pawns.toFixed(1)
  }
  return '—'
}

export function EvalPanel({
  isReady,
  isEvaluating,
  result,
  error,
  isGameLoaded,
  onEvaluate,
}: EvalPanelProps) {
  const disabled = !isReady || !isGameLoaded || isEvaluating

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={onEvaluate}
        disabled={disabled}
        className="w-full px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
      >
        Stellung bewerten
      </button>
      {isEvaluating && (
        <p className="text-slate-400 text-sm animate-pulse">Bewerte…</p>
      )}
      {!isEvaluating && result && (
        <div className="flex justify-between text-sm px-1">
          <span className="font-semibold">{formatEval(result)}</span>
          {result.bestMoveSan && (
            <span className="font-mono text-slate-300">
              Bester Zug: {result.bestMoveSan}
            </span>
          )}
        </div>
      )}
      {error && <p className="text-red-400 text-xs px-1">{error}</p>}
    </div>
  )
}
