interface ReviewPanelProps {
  // False before Analyze Game has run / before any move is selected — shows a hint instead
  // of the coach bubble.
  active: boolean
  headline: string
  evalBadge: string
  sub: 'idle' | 'explain' | 'best'
  canBest: boolean
  canExplain: boolean
  canNext: boolean
  // Explain sub-mode: the PV as SAN strings, and which one is currently shown on the board.
  lineSans: string[]
  lineStep: number
  onExplain: () => void
  onBest: () => void
  onNext: () => void
  onLinePrev: () => void
  onLineNext: () => void
  onGotIt: () => void
  onResume: () => void
}

const PRIMARY_BTN =
  'px-3 py-1.5 rounded bg-cc-green text-white text-xs font-medium hover:bg-cc-green-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
const SECONDARY_BTN =
  'px-3 py-1.5 rounded bg-cc-surface text-cc-text-dim text-xs font-medium hover:bg-cc-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

export function ReviewPanel({
  active,
  headline,
  evalBadge,
  sub,
  canBest,
  canExplain,
  canNext,
  lineSans,
  lineStep,
  onExplain,
  onBest,
  onNext,
  onLinePrev,
  onLineNext,
  onGotIt,
  onResume,
}: ReviewPanelProps) {
  if (!active) {
    return (
      <div className="bg-cc-panel rounded p-3 text-sm">
        <div className="text-cc-text-faint text-xs italic">
          Analyze the game to start the guided review.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-cc-panel rounded p-3 text-sm flex flex-col gap-2">
      <div className="text-cc-text-dim font-semibold text-xs uppercase tracking-wide">
        Game Review
      </div>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 shrink-0 rounded-full bg-cc-surface flex items-center justify-center text-base">
          🧑‍🏫
        </div>
        <div className="flex-1 bg-cc-surface rounded px-3 py-2 flex items-center justify-between gap-2">
          <span className="text-cc-text text-xs leading-relaxed">{headline}</span>
          {evalBadge && (
            <span className="shrink-0 font-mono text-xs font-semibold text-cc-text-dim">
              {evalBadge}
            </span>
          )}
        </div>
      </div>

      {sub === 'idle' && (
        <div className="flex gap-2">
          <button onClick={onExplain} disabled={!canExplain} className={SECONDARY_BTN}>
            Explain
          </button>
          {canBest && (
            <button onClick={onBest} className={SECONDARY_BTN}>
              Best
            </button>
          )}
          <button onClick={onNext} disabled={!canNext} className={`${PRIMARY_BTN} flex-1`}>
            Next
          </button>
        </div>
      )}

      {sub === 'best' && (
        <div className="flex gap-2">
          <button onClick={onExplain} disabled={!canExplain} className={SECONDARY_BTN}>
            Explain
          </button>
          <button onClick={onResume} className={`${PRIMARY_BTN} flex-1`}>
            Resume
          </button>
        </div>
      )}

      {sub === 'explain' && (
        <>
          <div className="flex gap-2">
            <button
              onClick={onLinePrev}
              disabled={lineStep <= 0}
              className={SECONDARY_BTN}
              title="Previous move in line"
            >
              ◀
            </button>
            <button
              onClick={onLineNext}
              disabled={lineStep >= lineSans.length - 1}
              className={SECONDARY_BTN}
              title="Next move in line"
            >
              ▶
            </button>
            <button onClick={onGotIt} className={`${PRIMARY_BTN} flex-1`}>
              Got it!
            </button>
          </div>
          {lineSans.length > 0 && (
            <div className="flex flex-wrap gap-1 text-xs font-mono px-1">
              {lineSans.map((san, i) => (
                <span
                  key={i}
                  className={
                    i === lineStep
                      ? 'px-1.5 py-0.5 rounded bg-cc-green text-white font-semibold'
                      : 'px-1.5 py-0.5 text-cc-text-dim'
                  }
                >
                  {san}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
