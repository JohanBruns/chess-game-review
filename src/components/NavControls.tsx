// chess.com's Game Review sidebar footer: five equal-width buttons (first/prev/play/next/last)
// with SVG chevron icons — not emoji, and not the small under-board strip this component used
// to render (that's now BoardToolbar). Lives at the bottom of the sidebar column in App.tsx,
// shared across the setup/summary/review chapters.
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
}

const BTN =
  'flex-1 h-11 flex items-center justify-center rounded-[5px] bg-cc-surface hover:bg-cc-surface-hover text-[rgba(255,255,255,0.72)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors'

function IconFirst() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 3v10M13 3 6 8l7 5V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
function IconPrev() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M11 3 4 8l7 5V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
function IconNext() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M5 3l7 5-7 5V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
function IconLast() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M12 3v10M3 3l7 5-7 5V3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
function IconPlay() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4 2.5v11l10-5.5-10-5.5Z" />
    </svg>
  )
}
function IconPause() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3.5" y="2.5" width="3" height="11" rx="0.75" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="0.75" />
    </svg>
  )
}

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
}: NavControlsProps) {
  return (
    <div className="flex gap-1.5 p-2">
      <button className={BTN} onClick={onFirst} disabled={!isLoaded || !canGoPrev || takeover} title="First Move (Home)">
        <IconFirst />
      </button>
      <button className={BTN} onClick={onPrev} disabled={!isLoaded || !canGoPrev || takeover} title="Previous Move (←)">
        <IconPrev />
      </button>
      <button
        className={BTN}
        onClick={onToggleAutoplay}
        disabled={!isLoaded || takeover}
        title={autoplay ? 'Pause autoplay' : 'Autoplay'}
        aria-pressed={autoplay}
      >
        {autoplay ? <IconPause /> : <IconPlay />}
      </button>
      <button className={BTN} onClick={onNext} disabled={!isLoaded || !canGoNext || takeover} title="Next Move (→)">
        <IconNext />
      </button>
      <button className={BTN} onClick={onLast} disabled={!isLoaded || !canGoNext || takeover} title="Last Move (End)">
        <IconLast />
      </button>
    </div>
  )
}
