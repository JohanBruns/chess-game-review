import { IconCamera, IconCheck, IconFlip, IconGear, IconLink, IconPalette } from './icons'

// chess.com's 32px board-controls column, standing to the right of the board with the settings
// gear at the top — here also holding flip/theme/share/export. Split out of the old NavControls
// (whose move-navigation buttons now live in the sidebar footer instead).
interface BoardToolbarProps {
  onFlip: () => void
  onOpenThemes: () => void
  onOpenSettings: () => void
  onCopyLink: () => void
  onExportImage: () => void
  linkCopied: boolean
  isLoaded: boolean
  // Phase 8: share/export act on the underlying game position, not a practice/puzzle board —
  // disabled during a takeover so they can't be used against the wrong position. Flip/theme/
  // settings stay usable (matches the pre-split NavControls behavior).
  takeover?: boolean
}

const BTN =
  'w-8 h-8 flex items-center justify-center rounded-[3px] text-white/50 hover:text-white disabled:opacity-30 disabled:hover:text-white/50 disabled:cursor-not-allowed transition-colors'

export function BoardToolbar({
  onFlip,
  onOpenThemes,
  onOpenSettings,
  onCopyLink,
  onExportImage,
  linkCopied,
  isLoaded,
  takeover = false,
}: BoardToolbarProps) {
  return (
    <div className="w-8 shrink-0 flex flex-col items-center gap-1">
      <button className={BTN} onClick={onOpenSettings} title="Settings" aria-label="Settings">
        <IconGear size={22} />
      </button>
      <button className={BTN} onClick={onFlip} disabled={!isLoaded} title="Flip Board (F)" aria-label="Flip Board">
        <IconFlip />
      </button>
      <button className={BTN} onClick={onOpenThemes} title="Board &amp; Pieces" aria-label="Board and Pieces">
        <IconPalette />
      </button>
      <button
        className={BTN}
        onClick={onCopyLink}
        disabled={!isLoaded || takeover}
        title={linkCopied ? 'Copied!' : 'Copy analysis link'}
        aria-label="Copy analysis link"
      >
        {linkCopied ? <IconCheck className="text-cc-green" /> : <IconLink />}
      </button>
      <button
        className={BTN}
        onClick={onExportImage}
        disabled={!isLoaded || takeover}
        title="Export board image"
        aria-label="Export board image"
      >
        <IconCamera />
      </button>
    </div>
  )
}
