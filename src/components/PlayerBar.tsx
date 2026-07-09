import { formatClock } from '../lib/analysis/clocks'

interface PlayerBarProps {
  name: string
  elo?: number
  // Static "as of the current ply" reading (see remainingClockSeconds) — chess.com's Game
  // Review doesn't tick a live countdown, it just shows the clock as it stood at that point.
  clockSeconds: number | null
}

// Opponent-above / self-below strip framing the board, chess.com-style: avatar initial, bold
// name + dimmed rating, and a dark clock pill on the right. Two instances are rendered in
// App.tsx (top = the side opposite `orientation`, bottom = `orientation`'s own side).
export function PlayerBar({ name, elo, clockSeconds }: PlayerBarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className="flex items-center justify-between gap-2 px-0.5">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 shrink-0 rounded bg-cc-surface flex items-center justify-center text-cc-text-dim text-xs font-bold select-none">
          {initial}
        </div>
        <span className="truncate text-sm">
          <span className="font-bold text-cc-text">{name}</span>
          {elo != null && <span className="text-cc-text-dim ml-1">({elo})</span>}
        </span>
      </div>
      {clockSeconds != null && (
        <span className="shrink-0 flex items-center gap-1.5 bg-cc-bg-dark rounded px-2.5 py-1 font-mono text-base font-bold tabular-nums text-cc-text">
          <span aria-hidden className="text-xs">⏱</span>
          {formatClock(clockSeconds)}
        </span>
      )}
    </div>
  )
}
