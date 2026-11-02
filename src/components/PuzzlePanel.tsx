import { SidebarHeader } from './SidebarHeader'
import { IconArrowLeft, IconPuzzle } from './icons'
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

const PRIMARY_BTN = 'cc-btn-primary h-10 px-4 rounded-[5px] text-sm font-semibold'
const SECONDARY_BTN = 'cc-btn-secondary h-10 px-4 rounded-[5px] text-sm font-semibold'

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
      <SidebarHeader
        title={finished ? 'Puzzles' : `Puzzles · ${index + 1} / ${total}`}
        icon={<IconPuzzle size={22} className="text-cc-green" />}
        start={{ icon: <IconArrowLeft />, label: 'Exit puzzles', onClick: onExit }}
      />

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
          <div className="flex flex-col gap-3 p-4">
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

          <div className="shrink-0 flex flex-wrap gap-2 px-4 pb-2">
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
