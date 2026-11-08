import { IconChevronLeft, IconChevronRight } from './icons'
import { PhoneMenu, type MenuAction } from './PhoneMenu'

export type FooterAction = MenuAction

interface PhoneFooterProps {
  // Board/app actions that live in the desktop controls column (settings, flip, themes, share,
  // export, …) — collected behind the footer's gear on phones.
  menu: FooterAction[]
  // Extra ghost buttons next to the gear.
  extras?: FooterAction[]
  // The green button in the middle; none in the setup chapter.
  primary?: FooterAction | null
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
}

const GHOST_BTN =
  'w-10 h-10 shrink-0 flex items-center justify-center rounded-[5px] text-white/50 hover:text-white hover:bg-white/7 disabled:opacity-30 disabled:hover:text-white/50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors'

// chess.com's mobile footer, measured at 375x812: a 49px bar fixed to the bottom of the screen
// (#312e2b, 1px white/10 top border, 4px 12px padding) with three groups of 40px icon buttons —
// actions on the left, the green primary action centered, and the previous/next move arrows on
// the right. Phones only, for the loader chapter and practice/puzzles; the guided review has its
// own bar (PhoneReviewBar) and the summary none.
export function PhoneFooter({ menu, extras = [], primary, onPrev, onNext, canPrev, canNext }: PhoneFooterProps) {
  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-[#312e2b] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <div className="h-12 px-3 py-1 flex items-center">
        <div className="flex-1 basis-0 flex items-center gap-1">
          <PhoneMenu actions={menu} placement="up" />
          {extras.map(a => (
            <button key={a.label} className={GHOST_BTN} onClick={a.onClick} disabled={a.disabled} title={a.label} aria-label={a.label}>
              {a.icon}
            </button>
          ))}
        </div>

        {primary && (
          <button
            className="cc-btn-primary w-10 h-10 shrink-0 mx-3 rounded-[5px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={primary.onClick}
            disabled={primary.disabled}
            title={primary.label}
            aria-label={primary.label}
          >
            {primary.icon}
          </button>
        )}

        <div className="flex-1 basis-0 flex items-center justify-end gap-1">
          <button className={GHOST_BTN} onClick={onPrev} disabled={!canPrev} title="Previous Move" aria-label="Previous Move">
            <IconChevronLeft />
          </button>
          <button className={GHOST_BTN} onClick={onNext} disabled={!canNext} title="Next Move" aria-label="Next Move">
            <IconChevronRight />
          </button>
        </div>
      </div>
    </div>
  )
}
