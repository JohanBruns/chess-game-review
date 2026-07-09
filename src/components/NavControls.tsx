interface NavControlsProps {
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  onFlip: () => void
  onOpenThemes: () => void
  onOpenSettings: () => void
  // Share/Export (Phase 7) — both no-op-disabled when no game is loaded.
  onCopyLink: () => void
  onExportImage: () => void
  linkCopied: boolean
  canGoPrev: boolean
  canGoNext: boolean
  isLoaded: boolean
}

export function NavControls({
  onFirst,
  onPrev,
  onNext,
  onLast,
  onFlip,
  onOpenThemes,
  onOpenSettings,
  onCopyLink,
  onExportImage,
  linkCopied,
  canGoPrev,
  canGoNext,
  isLoaded,
}: NavControlsProps) {
  const base =
    'px-3 py-1.5 rounded font-mono text-sm bg-cc-surface hover:bg-cc-surface-hover text-cc-text disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <div className="flex justify-center gap-2">
      <button
        className={base}
        onClick={onFirst}
        disabled={!isLoaded || !canGoPrev}
        title="First Move (Home)"
      >
        ⏮
      </button>
      <button
        className={base}
        onClick={onPrev}
        disabled={!isLoaded || !canGoPrev}
        title="Previous Move (←)"
      >
        ◀
      </button>
      <button
        className={base}
        onClick={onNext}
        disabled={!isLoaded || !canGoNext}
        title="Next Move (→)"
      >
        ▶
      </button>
      <button
        className={base}
        onClick={onLast}
        disabled={!isLoaded || !canGoNext}
        title="Last Move (End)"
      >
        ⏭
      </button>
      <button
        className={base}
        onClick={onFlip}
        disabled={!isLoaded}
        title="Flip Board (F)"
      >
        ⇅
      </button>
      <button
        className={base}
        onClick={onOpenThemes}
        title="Board &amp; Pieces"
      >
        🎨
      </button>
      <button
        className={base}
        onClick={onOpenSettings}
        title="Settings"
      >
        ⚙️
      </button>
      <button
        className={base}
        onClick={onCopyLink}
        disabled={!isLoaded}
        title={linkCopied ? 'Copied!' : 'Copy analysis link'}
      >
        {linkCopied ? '✓' : '🔗'}
      </button>
      <button
        className={base}
        onClick={onExportImage}
        disabled={!isLoaded}
        title="Export board image"
      >
        📷
      </button>
    </div>
  )
}
