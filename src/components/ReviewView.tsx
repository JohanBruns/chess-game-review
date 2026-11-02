import type { ReactNode } from 'react'
import type { MoveClass } from '../lib/analysis/classify'
import { CLASS_ICON } from '../lib/analysis/classIcons'
import { classTextColor } from '../lib/analysis/classColors'
import type { CommentToken } from '../lib/analysis/commentary'
import type { HeadlineParts } from '../lib/analysis/review'
import type { ThemeHighlight } from '../lib/analysis/tactics'
import { CoachBubble } from './CoachBubble'
import { CoachSpeech } from './CoachSpeech'
import { SidebarHeader } from './SidebarHeader'
import {
  IconArrowLeft,
  IconArrowRight,
  IconBulb,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconPlay,
  IconStar,
} from './icons'

interface ReviewViewProps {
  onBack: () => void

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

// chess.com's flow buttons under the coach bubble: 40px tall, 5px radius, 14px/600 label with a
// 20px icon — green gradient for the main action, the grey gradient skin for the others.
const PRIMARY_BTN =
  'cc-btn-primary h-10 rounded-[5px] text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2'
const SECONDARY_BTN =
  'cc-btn-secondary h-10 rounded-[5px] text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2'

// Sidebar "chapter 2" — chess.com's guided Game Review walkthrough, measured live (2026-11-02,
// 1440x900): a back-arrow header, the coach bubble on top (class icon + move headline + light
// eval pill, top-aligned with the coach), an Explain/Best/Next button row, the move list filling
// the middle, and the 80px eval graph at the bottom. "Next" steps the game one move at a time
// from ply 1 to the end (chess.com does NOT use a key-moment agenda — the coach comments on every
// move), so it simply reuses App's goToNext. This view REPLACES the setup/summary sidebar
// contents — see sidebarView in App.tsx.
export function ReviewView({
  onBack,
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
      <SidebarHeader
        title="Game Review"
        icon={<img src="/marks/best_128x.png" alt="" className="w-6 h-6" />}
        start={{ icon: <IconArrowLeft />, label: 'Back to summary', onClick: onBack }}
      />

      <div className="flex-1 min-h-0 flex flex-col px-4 pt-4">
        <div className="shrink-0 flex flex-col gap-2">
          {coachEnabled && (
            // chess.com reserves a fixed 156px for the coach so the buttons below never jump
            // between short and long comments.
            <div className="min-h-[156px]">
              <CoachSpeech align="top">
                {active ? (
                  // chess.com's move-feedback box: a first row with the class icon, the class name
                  // and a light eval pill, then the explanation below (15px/500).
                  <div className="flex flex-col min-h-[90px]">
                    <div className="h-[30px] flex items-start gap-1.5">
                      {sub === 'explain' ? (
                        <IconBulb size={24} className="shrink-0 mt-0.5 text-[#f7c631]" />
                      ) : (
                        coachClass && (
                          <img src={CLASS_ICON[coachClass]} alt="" className="w-6 h-6 shrink-0 mt-0.5" />
                        )
                      )}
                      <span className="flex-1 min-w-0 font-semibold pt-[3px] truncate">
                        {sub === 'explain' ? 'Explain' : coachClass}
                      </span>
                      {/* Light pill while White is better, dark while Black is (chess.com's
                          score-text positive/negative). */}
                      {evalBadge && (
                        <span
                          className={`shrink-0 rounded-[3px] px-[5px] py-px font-bold ${
                            evalBadge.startsWith('-') ? 'bg-[#312e2b] text-white' : 'bg-[#e7e6e5]'
                          }`}
                        >
                          {evalBadge}
                        </span>
                      )}
                    </div>
                    <span>
                      {sub !== 'explain' && headlineParts && coachClass ? (
                        <>
                          <span className="font-semibold" style={{ color: classTextColor(coachClass) }}>
                            {headlineParts.san}
                          </span>{' '}
                          {headlineParts.middle}{' '}
                          <span className="font-semibold" style={{ color: classTextColor(coachClass) }}>
                            {headlineParts.classWord}
                          </span>
                          .
                        </>
                      ) : (
                        headline
                      )}
                      {sub === 'idle' && commentary && commentary.length > 0 && (
                        <>
                          {' '}
                          <CoachBubble
                            tokens={commentary}
                            activeHighlight={activeHighlight}
                            onHover={onHoverHighlight}
                            onPin={onPinHighlight}
                          />
                        </>
                      )}
                    </span>
                  </div>
                ) : (
                  <span className="text-[#312e2b]/60">Step through your moves with Next.</span>
                )}
              </CoachSpeech>
            </div>
          )}

          {/* chess.com drops the labels once several flow buttons share the row (icon-only,
              equal widths) and only spells out "Next" when it stands alone. */}
          {active && sub === 'idle' && (
            <div className="flex gap-2">
              {canExplain && (
                <button onClick={onExplain} className={`${SECONDARY_BTN} flex-1`} title="Explain" aria-label="Explain">
                  <IconBulb size={22} className="text-white/72" />
                </button>
              )}
              {canBest && (
                <button onClick={onBest} className={`${SECONDARY_BTN} flex-1`} title="Best move" aria-label="Best move">
                  <IconStar size={22} className="text-white/72" />
                </button>
              )}
              <button onClick={onNext} disabled={!canNext} className={`${PRIMARY_BTN} flex-1`} title="Next" aria-label="Next">
                <IconArrowRight size={22} />
                {!canExplain && !canBest && 'Next'}
              </button>
            </div>
          )}

          {!active && (
            <button onClick={onNext} disabled={!canNext} className={`${PRIMARY_BTN} w-full`}>
              <IconArrowRight /> Next
            </button>
          )}

          {active && sub === 'best' && (
            <button onClick={onResume} className={`${PRIMARY_BTN} w-full`}>
              <IconPlay /> Resume
            </button>
          )}

          {active && sub === 'explain' && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={onLinePrev}
                  disabled={lineStep <= 0}
                  className={`${SECONDARY_BTN} w-12 shrink-0`}
                  title="Previous move in line"
                  aria-label="Previous move in line"
                >
                  <IconChevronLeft className="text-white/72" />
                </button>
                <button
                  onClick={onLineNext}
                  disabled={lineStep >= lineSans.length - 1}
                  className={`${PRIMARY_BTN} w-12 shrink-0`}
                  title="Next move in line"
                  aria-label="Next move in line"
                >
                  <IconChevronRight />
                </button>
                <button onClick={onGotIt} className={`${SECONDARY_BTN} flex-1`}>
                  <IconCheck className="text-white/72" /> Got it!
                </button>
              </div>
              {lineSans.length > 0 && (
                <div className="flex flex-wrap gap-1 text-[13px] font-bold px-1">
                  {lineSans.map((san, i) => (
                    <span
                      key={i}
                      className={
                        i === lineStep
                          ? 'px-1 rounded-[2px] bg-white/14 border-b-[3px] border-white/10 text-white'
                          : 'px-1 text-white/72'
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

        {graph && <div className="shrink-0 pt-2">{graph}</div>}
      </div>
    </div>
  )
}
