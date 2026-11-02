import { IconChevronLeft, IconChevronRight, IconFirst, IconLast, IconPause, IconPlay } from './icons'

// chess.com's Game Review sidebar footer: five equal-width buttons (first/prev/play/next/last)
// with SVG chevron icons on a darker strip that closes off the sidebar card. Lives at the bottom
// of the sidebar column in App.tsx, shared by the setup/review/practice/puzzle chapters (the
// summary chapter shows its Start Review button there instead, like chess.com).
interface NavControlsProps {
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  canGoPrev: boolean
  canGoNext: boolean
  isLoaded: boolean
  // The middle "Play" button toggles settings.autoplay — App.tsx's autoplay effect actually
  // steps the game only while the guided Review chapter is idle, but the toggle itself is
  // harmless (and safely inert) anywhere else.
  autoplay: boolean
  onToggleAutoplay: () => void
  // Phase 8: a practice/puzzle game owns the board — disable move navigation (which acts on
  // the underlying game position, not the practice board) so it can't silently desync the
  // review ply.
  takeover?: boolean
  // chess.com's footer has a second, "tertiary" row of ghost buttons under the arrows.
  children?: React.ReactNode
}

// Measured against chess.com's Game Review footer (1440x900): 48px-tall, 10px-radius buttons
// with the secondary gradient skin (.cc-btn-secondary in index.css) and 24px icons.
const BTN =
  'cc-btn-secondary flex-1 h-12 flex items-center justify-center rounded-[10px] disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

export function NavControls({
  onFirst,
  onPrev,
  onNext,
  onLast,
  canGoPrev,
  canGoNext,
  isLoaded,
  autoplay,
  onToggleAutoplay,
  takeover = false,
  children,
}: NavControlsProps) {
  return (
    <div className="shrink-0 bg-black/14 rounded-b-[5px]">
      <div className={`flex gap-2 px-2 pt-4 ${children ? '' : 'pb-4'}`}>
        <button className={BTN} onClick={onFirst} disabled={!isLoaded || !canGoPrev || takeover} title="First Move (Home)">
          <IconFirst size={24} className="text-white/72" />
        </button>
        <button className={BTN} onClick={onPrev} disabled={!isLoaded || !canGoPrev || takeover} title="Previous Move (←)">
          <IconChevronLeft size={24} className="text-white/72" />
        </button>
        <button
          className={BTN}
          onClick={onToggleAutoplay}
          disabled={!isLoaded || takeover}
          title={autoplay ? 'Pause autoplay' : 'Autoplay'}
          aria-pressed={autoplay}
        >
          {autoplay ? <IconPause size={24} className="text-white/72" /> : <IconPlay size={24} className="text-white/72" />}
        </button>
        <button className={BTN} onClick={onNext} disabled={!isLoaded || !canGoNext || takeover} title="Next Move (→)">
          <IconChevronRight size={24} className="text-white/72" />
        </button>
        <button className={BTN} onClick={onLast} disabled={!isLoaded || !canGoNext || takeover} title="Last Move (End)">
          <IconLast size={24} className="text-white/72" />
        </button>
      </div>
      {children && <div className="flex justify-center gap-2 p-2">{children}</div>}
    </div>
  )
}
