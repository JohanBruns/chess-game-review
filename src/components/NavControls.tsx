interface NavControlsProps {
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  canGoPrev: boolean
  canGoNext: boolean
  isLoaded: boolean
}

export function NavControls({
  onFirst,
  onPrev,
  onNext,
  onLast,
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
    </div>
  )
}
