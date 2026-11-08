import type { ChessComGame } from '../lib/chesscom'

interface NewestGameBannerProps {
  game: ChessComGame
  // The saved chess.com username, to name the opponent.
  username: string
  onAnalyze: () => void
  onDismiss: () => void
}

// A newer game of yours turned up while the app was open (the archive lists games a few minutes
// late) — offered with one tap instead of swapping the game you're looking at. Sits just above
// the phone footer, and top-center on wider screens.
export function NewestGameBanner({ game, username, onAnalyze, onDismiss }: NewestGameBannerProps) {
  const isWhite = game.white.username.toLowerCase() === username.toLowerCase()
  const opponent = isWhite ? game.black : game.white
  return (
    <div
      role="status"
      className="fixed z-40 inset-x-3 bottom-[calc(57px+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:top-4 md:left-1/2 md:-translate-x-1/2 md:w-[380px] flex items-center gap-2 p-2 pl-3 rounded-[8px] bg-[#262421] border border-white/10 shadow-xl animate-chapter-fade-in"
    >
      <span className="flex-1 min-w-0 text-sm text-white/85 truncate">
        New game vs. <span className="font-bold text-white">{opponent.username}</span>
      </span>
      <button onClick={onAnalyze} className="cc-btn-primary h-9 px-3 rounded-[5px] text-sm font-semibold shrink-0">
        Analyze
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[5px] text-white/50 hover:text-white hover:bg-white/7"
      >
        ✕
      </button>
    </div>
  )
}
