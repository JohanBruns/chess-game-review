import { SidebarHeader } from './SidebarHeader'
import { IconArrowLeft } from './icons'

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
      <SidebarHeader
        title="Practice"
        start={{ icon: <IconArrowLeft />, label: 'Exit practice', onClick: onExit }}
      />

      <div className="flex flex-col gap-3 p-4">
        <p className="text-white/72 text-[13px] leading-relaxed">
          You are playing{' '}
          <span className="font-semibold text-cc-text">{userColor === 'w' ? 'White' : 'Black'}</span>{' '}
          against the engine from this position. Play it out to test your ideas.
        </p>

        <div className="bg-white/5 rounded-[5px] px-3 py-2.5 flex items-center justify-between gap-2">
          <span className={`text-sm font-semibold ${gameOver ? 'text-cc-green' : 'text-white'}`}>
            {status}
          </span>
          <span className="text-cc-text-faint text-[10px] tabular-nums shrink-0">
            {moveCount} {moveCount === 1 ? 'move' : 'moves'}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      <div className="shrink-0 px-4 pb-2">
        <button
          onClick={onExit}
          className="cc-btn-secondary w-full h-10 rounded-[5px] text-sm font-semibold"
        >
          Exit Practice
        </button>
      </div>
    </div>
  )
}
