interface HeaderAction {
  icon: React.ReactNode
  label: string
  onClick: () => void
}

interface SidebarHeaderProps {
  title: string
  // Small feature icon left of the title (chess.com shows the Game Review star here).
  icon?: React.ReactNode
  start?: HeaderAction
  end?: HeaderAction
}

const ICON_BTN =
  'w-11 h-12 short:h-10 shrink-0 flex items-center justify-center text-white/50 hover:text-white transition-colors'

// chess.com's sidebar header, measured at 1440x900: 48px tall on a rgba(0,0,0,.14) strip, 44px
// icon buttons at either end and the title (17px/600, 85% white) centered with its 24px feature
// icon. Every sidebar chapter uses it so the card's top edge never jumps between chapters.
export function SidebarHeader({ title, icon, start, end }: SidebarHeaderProps) {
  return (
    <div className="shrink-0 h-12 short:h-10 flex items-center bg-black/14 rounded-t-[5px]">
      {start ? (
        <button className={ICON_BTN} onClick={start.onClick} title={start.label} aria-label={start.label}>
          {start.icon}
        </button>
      ) : (
        <span className="w-11 shrink-0" />
      )}
      <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
        {icon}
        <h2 className="text-[17px] font-semibold leading-5 text-white/85 truncate">{title}</h2>
      </div>
      {end ? (
        <button className={ICON_BTN} onClick={end.onClick} title={end.label} aria-label={end.label}>
          {end.icon}
        </button>
      ) : (
        <span className="w-11 shrink-0" />
      )}
    </div>
  )
}
