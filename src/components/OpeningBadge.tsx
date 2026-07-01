import type { Opening } from '../lib/analysis/openings'

interface OpeningBadgeProps {
  opening: Opening | null
}

export function OpeningBadge({ opening }: OpeningBadgeProps) {
  if (!opening) return null
  return (
    <div className="px-4 py-1 text-sm text-cc-text-dim bg-cc-panel border-b border-cc-border">
      <span className="text-cc-text-faint mr-1">{opening.eco}</span>
      {opening.name}
    </div>
  )
}
