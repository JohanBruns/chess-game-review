import type { MoveClass } from '../lib/analysis/classify'
import type { PuzzleAttempt } from '../hooks/usePuzzles'

interface PuzzlePanelProps {
  index: number
  total: number
  solvedCount: number
  finished: boolean
  // Side to move in the current puzzle (whose best move the solver must find).
  sideToMove: 'w' | 'b' | null
  classification: MoveClass | null
  attempt: PuzzleAttempt | null
  revealed: boolean
  bestSan: string | null
  onTryAgain: () => void
  onReveal: () => void
  onNext: () => void
  onExit: () => void
}

const PRIMARY_BTN =
  'px-3 py-1.5 rounded bg-cc-green text-white text-xs font-semibold hover:bg-cc-green-hover transition-colors'
const SECONDARY_BTN =
  'px-3 py-1.5 rounded bg-cc-surface text-cc-text-dim text-xs font-medium hover:bg-cc-surface-hover transition-colors'

// Sidebar panel for "Puzzles from your mistakes" (Phase 8) — a sequential drill over the
// extractPuzzles candidates. Board interaction (drag = attempt) lives in usePuzzles / App; this
// shows the prompt, per-attempt feedback, and the flow controls (Try again / Show solution / Next).
export function PuzzlePanel({
  index,
  total,
  solvedCount,
  finished,
  sideToMove,
  classification,
  attempt,
  revealed,
  bestSan,
  onTryAgain,
  onReveal,
  onNext,
  onExit,
}: PuzzlePanelProps) {
  const isLast = index >= total - 1

  return (
    <div className="flex flex-col h-full overflow-hidden animate-chapter-fade-in">
      <div className="shrink-0 flex items-center gap-2 px-2 py-2 border-b border-cc-border/60">
        <button
          onClick={onExit}
          aria-label="Exit puzzles"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-cc-surface/60 transition-colors text-cc-text-dim"
        >
          ←
        </button>
        <h2 className="text-sm font-semibold">Puzzles</h2>
        {!finished && (
          <span className="ml-auto text-cc-text-faint text-xs tabular-nums">
            {index + 1} / {total}
          </span>
        )}
      </div>

      {finished ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 px-4 text-center">
          <div className="text-2xl font-bold text-cc-text">
            {solvedCount} / {total}
          </div>
          <p className="text-cc-text-dim text-xs">
            {solvedCount === total
              ? 'Perfect — you solved every puzzle!'
              : 'Puzzles complete. Review the ones you missed anytime.'}
          </p>
          <button onClick={onExit} className={`${PRIMARY_BTN} mt-2`}>
            Back to review
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 px-3 py-4">
            <p className="text-cc-text text-sm font-medium">
              {sideToMove === 'w' ? 'White' : 'Black'} to move — find the best move.
            </p>
            {classification && (
              <p className="text-cc-text-faint text-xs">
                In the game this was a{' '}
                <span className="font-semibold text-cc-text-dim">{classification}</span>.
              </p>
            )}

            {attempt === null && !revealed && (
              <p className="text-cc-text-dim text-xs">Drag a piece to make your move.</p>
            )}

            {attempt !== null && attempt.correct && (
              <p className="text-cc-green text-xs font-semibold">
                ✓ Correct — {attempt.san} is the engine's top move!
              </p>
            )}

            {attempt !== null && !attempt.correct && (
              <p className="text-cc-red text-xs font-semibold">
                ✗ {attempt.san} isn't it. Try again or reveal the solution.
              </p>
            )}

            {revealed && bestSan && (
              <p className="text-cc-text-dim text-xs">
                The best move was{' '}
                <span className="font-mono font-semibold text-cc-text">{bestSan}</span>, shown on the board.
              </p>
            )}
          </div>

          <div className="flex-1" />

          <div className="shrink-0 flex flex-wrap gap-2 p-2 border-t border-cc-border/60">
            {attempt !== null && !attempt.correct && !revealed && (
              <>
                <button onClick={onTryAgain} className={SECONDARY_BTN}>Try again</button>
                <button onClick={onReveal} className={SECONDARY_BTN}>Show solution</button>
              </>
            )}
            {(revealed || attempt?.correct) && (
              <button onClick={onNext} className={`${PRIMARY_BTN} flex-1`}>
                {isLast ? 'Finish' : 'Next puzzle'}
              </button>
            )}
            {attempt === null && !revealed && (
              <button onClick={onReveal} className={`${SECONDARY_BTN} ml-auto`}>Show solution</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
