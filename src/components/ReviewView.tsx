import type { ReactNode } from 'react'
import type { MoveClass } from '../lib/analysis/classify'
import { CLASS_ICON } from '../lib/analysis/classIcons'
import { classColor } from '../lib/analysis/classColors'
import type { CommentToken } from '../lib/analysis/commentary'
import type { HeadlineParts } from '../lib/analysis/review'
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
  // Plain-string headline, used as-is only for the explain sub-mode ("Explaining Bxf7+") where
  // the SAN doesn't sit at a fixed spot worth coloring separately.
  headline: string
  // Structured headline (idle/best sub-modes) so the SAN and classification word can be colored
  // and bolded per chess.com's coach-bubble style, while the connective words stay plain.
  headlineParts: HeadlineParts | null
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

// 36px tall, 5px radius, bold 14px, icon+label centered — matches chess.com's Explain/Best/Next
// row (verified against the reference screenshots).
const PRIMARY_BTN =
  'h-9 rounded-[5px] bg-cc-green text-white text-sm font-bold hover:bg-cc-green-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5'
const SECONDARY_BTN =
  'h-9 rounded-[5px] bg-[#3a3937] text-white/85 text-sm font-bold hover:bg-cc-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5'
const BTN_ICON = 'text-base leading-none'

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
  headlineParts,
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
        <h2 className="text-sm font-semibold">Game Review</h2>
      </div>

      <div className="shrink-0 flex flex-col gap-2 px-2 py-2 border-b border-cc-border/60">
        {coachEnabled && (
          <div className="flex items-start gap-2">
            <div className="w-14 h-14 shrink-0 rounded-lg bg-cc-surface overflow-hidden">
              <img src="/chess-coach.png" alt="Coach" className="w-full h-full object-cover" />
            </div>
            <div className="relative flex-1 bg-white rounded-lg px-3 py-2.5 min-h-14">
              <span
                aria-hidden
                className="absolute -left-1.5 top-4 w-3 h-3 bg-white rotate-45"
              />
              {active ? (
                <>
                  {evalBadge && (
                    <span className="absolute top-2 right-2 bg-[#312e2b] text-white text-[13px] font-bold rounded px-1.5 py-0.5">
                      {evalBadge}
                    </span>
                  )}
                  <div className="flex flex-col gap-1 pr-10">
                    <span className="flex items-center gap-1.5 text-[15px] leading-snug text-[#312e2b]">
                      {sub === 'explain' ? (
                        <span aria-hidden className="shrink-0">💡</span>
                      ) : (
                        coachClass && (
                          <img
                            src={CLASS_ICON[coachClass]}
                            alt={coachClass}
                            className="w-4 h-4 shrink-0"
                          />
                        )
                      )}
                      {sub !== 'explain' && headlineParts && coachClass ? (
                        <span>
                          <span className="font-bold" style={{ color: classColor(coachClass) }}>
                            {headlineParts.san}
                          </span>{' '}
                          <span>{headlineParts.middle}</span>{' '}
                          <span className="font-bold" style={{ color: classColor(coachClass) }}>
                            {headlineParts.classWord}
                          </span>
                        </span>
                      ) : (
                        <span className="font-semibold">{headline}</span>
                      )}
                    </span>
                    {sub === 'idle' && commentary && commentary.length > 0 && (
                      <span className="text-[13px] leading-relaxed text-[#312e2b]/85">
                        <CoachBubble
                          tokens={commentary}
                          activeHighlight={activeHighlight}
                          onHover={onHoverHighlight}
                          onPin={onPinHighlight}
                        />
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-[#312e2b]/50 text-[13px] italic">
                  Step through your moves with Next.
                </span>
              )}
            </div>
          </div>
        )}

        {active && sub === 'idle' && (
          <div className="flex gap-2">
            <button onClick={onExplain} disabled={!canExplain} className={`${SECONDARY_BTN} flex-1`}>
              <span aria-hidden className={BTN_ICON}>💡</span> Explain
            </button>
            {canBest && (
              <button onClick={onBest} className={`${SECONDARY_BTN} flex-1`}>
                <span aria-hidden className={BTN_ICON}>⭐</span> Best
              </button>
            )}
            <button onClick={onNext} disabled={!canNext} className={`${PRIMARY_BTN} flex-1`}>
              <span aria-hidden className={BTN_ICON}>→</span> Next
            </button>
          </div>
        )}

        {active && sub === 'best' && (
          <button onClick={onResume} className={`${PRIMARY_BTN} w-full`}>
            <span aria-hidden className={BTN_ICON}>▶</span> Resume
          </button>
        )}

        {active && sub === 'explain' && (
          <>
            <div className="flex gap-2">
              <button
                onClick={onLinePrev}
                disabled={lineStep <= 0}
                className={`${SECONDARY_BTN} w-9 shrink-0`}
                title="Previous move in line"
                aria-label="Previous move in line"
              >
                <span aria-hidden className={BTN_ICON}>‹</span>
              </button>
              <button
                onClick={onLineNext}
                disabled={lineStep >= lineSans.length - 1}
                className={`${PRIMARY_BTN} w-9 shrink-0`}
                title="Next move in line"
                aria-label="Next move in line"
              >
                <span aria-hidden className={BTN_ICON}>›</span>
              </button>
              <button onClick={onGotIt} className={`${SECONDARY_BTN} flex-1`}>
                <span aria-hidden className={BTN_ICON}>✓</span> Got it!
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

      {active && sub === 'idle' && canPractice && (
        <button
          onClick={onPractice}
          className="shrink-0 w-full py-1.5 text-xs text-cc-text-faint hover:text-cc-text-dim underline decoration-dotted underline-offset-2 transition-colors"
        >
          Practice from here
        </button>
      )}

      {retry}

      {graph && <div className="shrink-0 border-t border-cc-border">{graph}</div>}
    </div>
  )
}
