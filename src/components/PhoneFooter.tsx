import { useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconGear } from './icons'

export interface FooterAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}

interface PhoneFooterProps {
  // Board/app actions that live in the desktop controls column (settings, flip, themes, share,
  // export, …) — collected behind the footer's gear on phones.
  menu: FooterAction[]
  // Extra ghost buttons next to the gear (the review chapter's Explain / Best move).
  extras?: FooterAction[]
  // The green button in the middle (Start Review / Next / Resume / Got it); none in the setup
  // chapter.
  primary?: FooterAction | null
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
}

const GHOST_BTN =
  'w-10 h-10 shrink-0 flex items-center justify-center rounded-[5px] text-white/50 hover:text-white hover:bg-white/7 disabled:opacity-30 disabled:hover:text-white/50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors'

// chess.com's mobile Game Review footer, measured at 375x812: a 49px bar fixed to the bottom of
// the screen (#312e2b, 1px white/10 top border, 4px 12px padding) with three groups of 40px icon
// buttons — extra actions on the left, the green primary action centered, and the previous/next
// move arrows on the right. Phones only (App renders it below Tailwind's md breakpoint), where it
// replaces both the sidebar's nav footer and the board's controls column.
export function PhoneFooter({ menu, extras = [], primary, onPrev, onNext, canPrev, canNext }: PhoneFooterProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-[#312e2b] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <div className="h-12 px-3 py-1 flex items-center">
        <div className="relative flex-1 basis-0 flex items-center gap-1">
          <button
            className={`${GHOST_BTN} ${menuOpen ? 'text-white bg-white/7' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            title="Menu"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <IconGear size={22} />
          </button>
          {extras.map(a => (
            <button key={a.label} className={GHOST_BTN} onClick={a.onClick} disabled={a.disabled} title={a.label} aria-label={a.label}>
              {a.icon}
            </button>
          ))}

          {menuOpen && (
            <>
              <div className="fixed inset-0" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full left-0 mb-2 w-60 py-1 rounded-[5px] bg-[#262421] border border-white/10 shadow-xl">
                {menu.map(a => (
                  <button
                    key={a.label}
                    onClick={() => {
                      setMenuOpen(false)
                      a.onClick()
                    }}
                    disabled={a.disabled}
                    className="w-full h-11 px-4 flex items-center gap-3 text-[15px] font-semibold text-white/85 hover:bg-white/7 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                  >
                    <span className="w-6 flex justify-center text-white/50">{a.icon}</span>
                    {a.label}
                  </button>
                ))}
              </div>
            </>
          )}
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
