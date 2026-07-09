import type { MoveClass } from '../lib/analysis/classify'

interface RetryPanelProps {
  originalSan: string
  originalClassification: MoveClass
  attempt: { san: string; isCorrect: boolean | null } | null
  onRetryAgain: () => void
  onExit: () => void
}

export function RetryPanel({
  originalSan,
  originalClassification,
  attempt,
  onRetryAgain,
  onExit,
}: RetryPanelProps) {
  return (
    <div className="bg-cc-panel rounded p-3 text-sm flex flex-col gap-2">
      <div className="text-cc-text-dim font-semibold text-xs uppercase tracking-wide">
        Retry
      </div>
      <div className="text-cc-text">
        Find a better move than <span className="font-mono font-semibold">{originalSan}</span>
        {' '}({originalClassification})
      </div>

      {attempt === null && (
        <div className="text-cc-text-dim text-xs">Drag a piece to make your move.</div>
      )}

      {attempt !== null && attempt.isCorrect === true && (
        <div className="text-cc-green text-xs font-semibold">
          ✓ Correct — {attempt.san} is the engine's top choice!
        </div>
      )}

      {attempt !== null && attempt.isCorrect === false && (
        <div className="text-cc-red text-xs font-semibold">
          ✗ You played {attempt.san}. The best move is shown on the board.
        </div>
      )}

      {attempt !== null && attempt.isCorrect === null && (
        <div className="text-cc-text-dim text-xs">
          You played {attempt.san}. (No engine reference available for this position.)
        </div>
      )}

      <div className="flex gap-2">
        {attempt !== null && attempt.isCorrect === true ? (
          <button
            onClick={onExit}
            className="px-3 py-1 rounded bg-cc-green text-white text-xs font-semibold hover:bg-cc-green-hover transition-colors"
          >
            Continue
          </button>
        ) : (
          <>
            {attempt !== null && (
              <button
                onClick={onRetryAgain}
                className="px-3 py-1 rounded bg-cc-green text-white text-xs hover:bg-cc-green-hover transition-colors"
              >
                Try Again
              </button>
            )}
            <button
              onClick={onExit}
              className="px-3 py-1 rounded bg-cc-surface text-cc-text-dim text-xs hover:bg-cc-surface-hover transition-colors"
            >
              Exit Retry
            </button>
          </>
        )}
      </div>
    </div>
  )
}
