import type { EngineLine } from '../lib/analysis/lines'

interface EngineLinesProps {
  lines: EngineLine[]
  onHoverLine: (san: string | null) => void
}

function formatEval(line: EngineLine): string {
  if (line.mate) return line.cp !== null && line.cp > 0 ? '+M' : '-M'
  if (line.cp === null) return '—'
  const pawns = line.cp / 100
  return pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2)
}

// chess.com-style engine-lines panel: the analysis-mode candidate moves for the CURRENT
// position, ranked best-first. Hovering a row is how the caller decides which single
// move gets the board arrow — chess.com never draws more than one candidate arrow at once.
export function EngineLines({ lines, onHoverLine }: EngineLinesProps) {
  if (lines.length === 0) return null

  return (
    <div className="flex flex-col gap-0.5 px-1 py-1 bg-cc-panel rounded text-xs font-mono">
      {lines.map((line, i) => (
        <div
          key={`${line.san}-${i}`}
          onMouseEnter={() => onHoverLine(line.san)}
          onMouseLeave={() => onHoverLine(null)}
          className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-cc-surface-hover cursor-default"
        >
          <span className="w-14 shrink-0 font-semibold text-cc-text-dim">{formatEval(line)}</span>
          <span className="text-cc-text">{line.san}</span>
        </div>
      ))}
    </div>
  )
}
