const LEGEND = [
  { src: '/marks/book_128x.png',      label: 'Book'           },
  { src: '/marks/brilliant_128x.png', label: 'Brilliant (!!)' },
  { src: '/marks/great_find_128x.png',label: 'Great (!)'      },
  { src: '/marks/best_128x.png',      label: 'Best'           },
  { src: '/marks/excellent_128x.png', label: 'Excellent'      },
  { src: '/marks/good_128x.png',      label: 'Good'           },
  { src: '/marks/inaccuracy_128x.png',label: 'Inaccuracy'     },
  { src: '/marks/mistake_128x.png',   label: 'Mistake'        },
  { src: '/marks/blunder_128x.png',   label: 'Blunder'        },
]

export function ClassLegend() {
  return (
    <div className="shrink-0 border-t border-cc-border px-3 py-2">
      <div className="text-[10px] text-cc-text-faint uppercase tracking-wide mb-1.5">Legend</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {LEGEND.map(({ src, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[11px]">
            <img src={src} alt={label} className="w-4 h-4 shrink-0" />
            <span className="text-cc-text-dim">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
