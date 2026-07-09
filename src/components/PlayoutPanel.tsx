interface PlayoutPanelProps {
  userColor: 'w' | 'b'
  isUserTurn: boolean
  engineThinking: boolean
  gameOver: boolean
  resultText: string | null
  moveCount: number
  onExit: () => void
}

// Sidebar panel for "Practice from here" (Phase 8) — a full-height chapter that replaces the
// review/summary sidebar while the user plays the position out against Stockfish. Board interaction
// and the engine reply loop live in usePlayout / App; this only shows status and the exit control.
export function PlayoutPanel({
  userColor,
  isUserTurn,
  engineThinking,
  gameOver,
  resultText,
  moveCount,
  onExit,
}: PlayoutPanelProps) {
  const status = gameOver
    ? resultText ?? 'Game over.'
    : engineThinking
      ? 'Engine is thinking…'
      : isUserTurn
        ? 'Your move — drag a piece.'
        : '…'

  return (
    <div className="flex flex-col h-full overflow-hidden animate-chapter-fade-in">
      <div className="shrink-0 flex items-center gap-2 px-2 py-2 border-b border-cc-border/60">
        <button
          onClick={onExit}
          aria-label="Exit practice"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-cc-surface/60 transition-colors text-cc-text-dim"
        >
          ←
        </button>
        <h2 className="font-heading text-sm font-semibold">Practice</h2>
      </div>

      <div className="flex flex-col gap-3 px-3 py-4">
        <p className="text-cc-text-dim text-xs leading-relaxed">
          You are playing{' '}
          <span className="font-semibold text-cc-text">{userColor === 'w' ? 'White' : 'Black'}</span>{' '}
          against the engine from this position. Play it out to test your ideas.
        </p>

        <div className="bg-cc-surface rounded px-3 py-2 flex items-center justify-between gap-2">
          <span className={`text-xs font-medium ${gameOver ? 'text-cc-green' : 'text-cc-text'}`}>
            {status}
          </span>
          <span className="text-cc-text-faint text-[10px] tabular-nums shrink-0">
            {moveCount} {moveCount === 1 ? 'move' : 'moves'}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="shrink-0 p-2">
        <button
          onClick={onExit}
          className="w-full px-3 py-2 rounded bg-cc-surface hover:bg-cc-surface-hover text-cc-text-dim text-sm font-medium transition-colors"
        >
          Exit Practice
        </button>
      </div>
    </div>
  )
}
