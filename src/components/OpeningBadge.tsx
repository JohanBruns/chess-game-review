import type { Opening } from '../lib/analysis/openings'

interface OpeningBadgeProps {
  opening: Opening | null
}

export function OpeningBadge({ opening }: OpeningBadgeProps) {
  if (!opening) return null
  return (
    <div className="shrink-0 px-4 pb-3 text-[13px] text-white/72 truncate">
      <span className="text-white/50 mr-1">{opening.eco}</span>
      {opening.name}
    </div>
  )
}
