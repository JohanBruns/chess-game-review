import { useMemo } from 'react'
import type { MoveAnalysis, MoveClass } from '../lib/analysis/classify'

const LEGEND: { classification: MoveClass; src: string; label: string }[] = [
  { classification: 'Book',       src: '/marks/book_128x.png',       label: 'Book'           },
  { classification: 'Brilliant',  src: '/marks/brilliant_128x.png',  label: 'Brilliant (!!)' },
  { classification: 'Great',      src: '/marks/great_find_128x.png', label: 'Great (!)'      },
  { classification: 'Best',       src: '/marks/best_128x.png',       label: 'Best'           },
  { classification: 'Excellent',  src: '/marks/excellent_128x.png',  label: 'Excellent'      },
  { classification: 'Good',       src: '/marks/good_128x.png',       label: 'Good'           },
  { classification: 'Inaccuracy', src: '/marks/inaccuracy_128x.png', label: 'Inaccuracy'     },
  { classification: 'Mistake',    src: '/marks/mistake_128x.png',    label: 'Mistake'        },
  { classification: 'Blunder',    src: '/marks/blunder_128x.png',    label: 'Blunder'        },
  { classification: 'Miss',       src: '/marks/miss_128x.png',       label: 'Miss'           },
  { classification: 'Forced',     src: '/marks/forced_128x.png',     label: 'Forced'         },
]

interface ClassLegendProps {
  moveAnalyses: MoveAnalysis[] | null
}

export function ClassLegend({ moveAnalyses }: ClassLegendProps) {
  const counts = useMemo(() => {
    const result: Record<MoveClass, { white: number; black: number }> = {
      Book: { white: 0, black: 0 },
      Brilliant: { white: 0, black: 0 },
      Great: { white: 0, black: 0 },
      Best: { white: 0, black: 0 },
      Excellent: { white: 0, black: 0 },
      Good: { white: 0, black: 0 },
      Inaccuracy: { white: 0, black: 0 },
      Mistake: { white: 0, black: 0 },
      Blunder: { white: 0, black: 0 },
      Miss: { white: 0, black: 0 },
      Forced: { white: 0, black: 0 },
    }
    for (const a of moveAnalyses ?? []) {
      const side = a.moveIndex % 2 === 0 ? 'white' : 'black'
      result[a.classification][side]++
    }
    return result
  }, [moveAnalyses])

  return (
    <div className="shrink-0 border-t border-cc-border px-3 py-1.5">
      <div className="flex items-center justify-between text-[10px] text-cc-text-faint uppercase tracking-wide mb-1">
        <span>Legend</span>
        {moveAnalyses && (
          <span className="flex gap-1.5 normal-case tracking-normal">
            <span className="w-4 text-center">W</span>
            <span className="w-4 text-center">B</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {LEGEND.map(({ classification, src, label }) => {
          const c = counts[classification]
          return (
            <div key={label} className="flex items-center gap-1.5 text-[11px]">
              <img src={src} alt={label} className="w-4 h-4 shrink-0" />
              <span className="text-cc-text-dim truncate">{label}</span>
              {moveAnalyses && (
                <span className="flex gap-1.5 text-cc-text-dim tabular-nums shrink-0 ml-auto text-xs font-medium">
                  <span className="w-4 text-center">{c.white}</span>
                  <span className="w-4 text-center">{c.black}</span>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
