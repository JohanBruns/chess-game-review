// Small dezent icon strip under the board — flip/theme/settings/share/export. Split out of the
// old NavControls (which used to bundle these with the move-navigation buttons); those now live
// in the sidebar footer instead. Text glyphs stand in for icons here (kept simple, no SVG set
// for these five) but styled transparent/muted rather than as filled emoji buttons.
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
  'w-7 h-7 flex items-center justify-center rounded text-cc-text-faint hover:text-cc-text hover:bg-cc-surface/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm'

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
    <div className="flex justify-center gap-1">
      <button className={BTN} onClick={onFlip} disabled={!isLoaded} title="Flip Board (F)">
        ⇅
      </button>
      <button className={BTN} onClick={onOpenThemes} title="Board &amp; Pieces">
        🎨
      </button>
      <button className={BTN} onClick={onOpenSettings} title="Settings">
        ⚙️
      </button>
      <button
        className={BTN}
        onClick={onCopyLink}
        disabled={!isLoaded || takeover}
        title={linkCopied ? 'Copied!' : 'Copy analysis link'}
      >
        {linkCopied ? '✓' : '🔗'}
      </button>
      <button className={BTN} onClick={onExportImage} disabled={!isLoaded || takeover} title="Export board image">
        📷
      </button>
    </div>
  )
}
