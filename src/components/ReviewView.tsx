import type { ReactNode } from 'react'
import type { MoveClass } from '../lib/analysis/classify'
import { CLASS_ICON } from '../lib/analysis/classIcons'
import type { CommentToken } from '../lib/analysis/commentary'
import type { ThemeHighlight } from '../lib/analysis/tactics'
import { CoachBubble } from './CoachBubble'

interface ReviewViewProps {
  onBack: () => void
  // Phase 8: "Practice" hands the current position to the play-out-vs-engine mode. Disabled until
  // the engine is ready and there's a real position to play (currentPly > 0).
  onPractice: () => void
  canPractice: boolean

  // Coach state — mirrors the old ReviewPanel's idle/best/explain sub-modes, now hoisted to
  // the top of the sidebar chapter (chess.com puts the coach above the move list, not below).
  active: boolean
  // settings.coachEnabled — hides only the coach bubble's content (avatar/text/eval badge);
  // the Explain/Best/Next button row stays functional either way.
  coachEnabled: boolean
  headline: string
  // Rich per-move commentary tokens (idle sub-mode only). When present the coach renders these —
  // with hoverable tactical phrases — instead of the plain `headline`.
  commentary: CommentToken[] | null
  activeHighlight: ThemeHighlight | null
  onHoverHighlight: (highlight: ThemeHighlight | null) => void
  onPinHighlight: (highlight: ThemeHighlight) => void
  evalBadge: string
  // Class icon shown in the bubble: in idle mode this is the played move's classification, in
  // best mode it's forced to 'Best' by the caller; null hides the icon (e.g. before any move).
  coachClass: MoveClass | null
  sub: 'idle' | 'explain' | 'best'
  canBest: boolean
  canExplain: boolean
  canNext: boolean
  lineSans: string[]
  lineStep: number
  onExplain: () => void
  onBest: () => void
  onNext: () => void
  onLinePrev: () => void
  onLineNext: () => void
  onGotIt: () => void
  onResume: () => void

  // Existing components, instantiated by App with all their props, dropped into the layout.
  moveList: ReactNode
  graph: ReactNode
  retry?: ReactNode
}

const PRIMARY_BTN =
  'px-3 py-1.5 rounded bg-cc-green text-white text-xs font-medium hover:bg-cc-green-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
const SECONDARY_BTN =
  'px-3 py-1.5 rounded bg-cc-surface text-cc-text-dim text-xs font-medium hover:bg-cc-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

// Sidebar "chapter 2" — chess.com's guided Game Review walkthrough. Structure verified against
// the reference screenshots (Board&Game/review/Screenshot_3/21/22/23/24/27/28, 2026-07-08): a
// back-arrow header, the coach bubble on top (class icon + move headline + eval badge), an
// Explain/Best/Next button row, the move list filling the middle, and a mini eval graph at the
// bottom. "Next" steps the game one move at a time from ply 1 to the end (chess.com does NOT use
// a key-moment agenda — the coach comments on every move), so it simply reuses App's goToNext.
// This view REPLACES the setup/summary sidebar contents — see sidebarView in App.tsx.
export function ReviewView({
  onBack,
  onPractice,
  canPractice,
  active,
  coachEnabled,
  headline,
  commentary,
  activeHighlight,
  onHoverHighlight,
  onPinHighlight,
  evalBadge,
  coachClass,
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
  moveList,
  graph,
  retry,
}: ReviewViewProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-chapter-fade-in">
      <div className="shrink-0 flex items-center gap-2 px-2 py-2 border-b border-cc-border/60">
        <button
          onClick={onBack}
          aria-label="Back to summary"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-cc-surface/60 transition-colors text-cc-text-dim"
        >
          ←
        </button>
        <h2 className="font-heading text-sm font-semibold">Game Review</h2>
      </div>

      <div className="shrink-0 flex flex-col gap-2 px-2 py-2 border-b border-cc-border/60">
        {coachEnabled && (
          <div className="flex items-start gap-2">
            <div className="w-9 h-9 shrink-0 rounded-full bg-cc-surface overflow-hidden">
              <img src="/chess-coach.png" alt="Coach" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 bg-cc-surface rounded px-3 py-2 flex items-start justify-between gap-2 min-h-9">
              {active ? (
                <>
                  <span className="flex items-start gap-1.5 text-cc-text text-xs leading-relaxed min-w-0">
                    {sub === 'explain' ? (
                      <span aria-hidden className="shrink-0 mt-px">💡</span>
                    ) : (
                      coachClass && (
                        <img
                          src={CLASS_ICON[coachClass]}
                          alt={coachClass}
                          className="w-4 h-4 shrink-0 mt-px"
                        />
                      )
                    )}
                    {sub === 'idle' && commentary && commentary.length > 0 ? (
                      <CoachBubble
                        tokens={commentary}
                        activeHighlight={activeHighlight}
                        onHover={onHoverHighlight}
                        onPin={onPinHighlight}
                      />
                    ) : (
                      <span>{headline}</span>
                    )}
                  </span>
                  {evalBadge && (
                    <span className="shrink-0 font-mono text-xs font-semibold text-cc-text-dim mt-px">
                      {evalBadge}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-cc-text-faint text-xs italic">
                  Step through your moves with Next.
                </span>
              )}
            </div>
          </div>
        )}

        {active && sub === 'idle' && (
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

        {active && sub === 'idle' && canPractice && (
          <button onClick={onPractice} className={`${SECONDARY_BTN} w-full`}>
            Practice from here
          </button>
        )}

        {active && sub === 'best' && (
          <div className="flex gap-2">
            <button onClick={onExplain} disabled={!canExplain} className={SECONDARY_BTN}>
              Explain
            </button>
            <button onClick={onResume} className={`${PRIMARY_BTN} flex-1`}>
              Resume
            </button>
          </div>
        )}

        {active && sub === 'explain' && (
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

      {moveList}

      {retry}

      {graph && <div className="shrink-0 border-t border-cc-border">{graph}</div>}
    </div>
  )
}
