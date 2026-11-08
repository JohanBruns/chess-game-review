import { useState } from 'react'
import { IconGear } from './icons'

export interface MenuAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}

// The phone's gear menu: the board/app actions that live in the desktop controls column
// (settings, flip, themes, share, export, practice). Opens upward from the footer, downward from
// the review header.
export function PhoneMenu({
  actions,
  placement,
  className = '',
}: {
  actions: MenuAction[]
  placement: 'up' | 'down'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`relative ${className}`}>
      <button
        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-[5px] text-white/50 hover:text-white hover:bg-white/7 transition-colors ${
          open ? 'text-white bg-white/7' : ''
        }`}
        onClick={() => setOpen(o => !o)}
        title="Menu"
        aria-label="Menu"
        aria-expanded={open}
      >
        <IconGear size={22} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-50 w-60 py-1 rounded-[5px] bg-[#262421] border border-white/10 shadow-xl ${
              placement === 'up' ? 'bottom-full left-0 mb-2' : 'top-full right-0 mt-1'
            }`}
          >
            {actions.map(a => (
              <button
                key={a.label}
                onClick={() => {
                  setOpen(false)
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
  )
}
