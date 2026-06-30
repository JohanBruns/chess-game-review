import type { Opening } from '../lib/analysis/openings'

interface OpeningBadgeProps {
  opening: Opening | null
}

export function OpeningBadge({ opening }: OpeningBadgeProps) {
  if (!opening) return null
  return (
    <div className="px-4 py-1 text-sm text-slate-300 bg-slate-800 border-b border-slate-700">
      <span className="text-slate-500 mr-1">{opening.eco}</span>
      {opening.name}
    </div>
  )
}
